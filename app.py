#!/usr/bin/env python3
"""
Clipper GUI — local web app wrapping the existing clip-generation pipeline.
Run with: python app.py
Opens automatically in your browser at http://localhost:5050
"""
import os
import sys
import uuid
import threading
import subprocess
import webbrowser
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
import librosa

from src.audio_extract import extract_audio
from src.transcribe import transcribe_audio
from src.audio_energy import score_energy
from src.content_score import score_content
from src.ranker import rank_clips
from src.cutter import cut_clips, cut_clip_with_settings
from src.video_probe import probe_video
from src.strategies import manual_clip, fixed_interval_clips

# When packaged with PyInstaller, look for .env next to the .exe, not in a temp folder.
if getattr(sys, "frozen", False):
    _app_dir = Path(sys.executable).parent
else:
    _app_dir = Path(__file__).parent
load_dotenv(_app_dir / ".env")

BASE_DIR = _app_dir
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

app = Flask(__name__, static_folder="static", static_url_path="")

# In-memory job store: job_id -> {status, step, log, clips, error}
JOBS = {}

# Second job store matching the Lovable frontend's Job/ClipResult contract exactly
# (kept separate from JOBS above so the original /api/process endpoint, used by
# this project's own static/app.js UI, is untouched).
ENGINE_JOBS = {}


def _reveal_path(path: Path):
    try:
        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin":
            subprocess.run(["open", str(path)])
        else:
            subprocess.run(["xdg-open", str(path)])
        return True, None
    except Exception as e:
        return False, str(e)


def run_pipeline(job_id: str, video_path: str, num_clips: int):
    job = JOBS[job_id]
    job_output_dir = OUTPUT_DIR / job_id
    temp_audio = str(job_output_dir / "temp_audio.wav")

    try:
        job_output_dir.mkdir(parents=True, exist_ok=True)

        job["step"] = "Extracting audio..."
        job["log"].append(job["step"])
        extract_audio(video_path, temp_audio)

        job["step"] = "Transcribing speech..."
        job["log"].append(job["step"])
        transcript = transcribe_audio(temp_audio)
        job["log"].append(
            f"Found {len(transcript)} speech segments."
            if transcript else "No speech detected — using audio energy only."
        )

        job["step"] = "Analyzing audio energy..."
        job["log"].append(job["step"])
        energy = score_energy(temp_audio)

        content_moments = []
        if transcript:
            if os.environ.get("ANTHROPIC_API_KEY"):
                job["step"] = "Scoring content for interesting moments..."
                job["log"].append(job["step"])
                content_moments = score_content(transcript)
            else:
                job["log"].append("No ANTHROPIC_API_KEY set — skipping content analysis, using audio energy only.")

        duration = librosa.get_duration(path=temp_audio)
        ranked = rank_clips(content_moments, energy, duration, num_clips)

        if not ranked:
            job["status"] = "error"
            job["error"] = "No suitable clips could be identified. Try a longer or louder video."
            return

        job["step"] = f"Cutting {len(ranked)} clip(s)..."
        job["log"].append(job["step"])
        files = cut_clips(video_path, ranked, str(job_output_dir))

        job["clips"] = [
            {
                "filename": Path(f).name,
                "job_id": job_id,
                "start": c["start"],
                "end": c["end"],
                "score": c["score"],
                "reason": c.get("reason", ""),
            }
            for f, c in zip(files, ranked)
        ]
        job["status"] = "done"
        job["step"] = "Done."
        job["log"].append("Done.")

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
        job["log"].append(f"Error: {e}")

    finally:
        Path(temp_audio).unlink(missing_ok=True)


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


def run_engine_job(job_id: str, video_path: str, settings: dict):
    """Runs a clipping job using the Lovable-contract settings shape.
    Supports strategy: 'manual', 'fixed-interval', or 'ai-highlights' (our addition)."""
    job = ENGINE_JOBS[job_id]

    out_dir_setting = settings.get("outputDirectory")
    if out_dir_setting:
        job_output_dir = Path(out_dir_setting)
    else:
        job_output_dir = OUTPUT_DIR / job_id
    job_output_dir.mkdir(parents=True, exist_ok=True)

    output_format = settings.get("outputFormat", "mp4")
    quality = settings.get("outputQuality", "high")
    aspect_ratio = settings.get("aspectRatio", "source")
    strategy = settings.get("strategy", "fixed-interval")
    start = float(settings.get("startSeconds", 0))
    end = settings.get("endSeconds")
    end = float(end) if end is not None else None

    try:
        job["status"] = "probing"
        job["currentOperation"] = "Reading video metadata"
        metadata = probe_video(video_path)
        duration = metadata["durationSeconds"]

        if job.get("cancel_requested"):
            job["status"] = "cancelled"
            return

        job["status"] = "clipping"
        job["currentOperation"] = "Planning clips"

        temp_audio = None
        if strategy == "manual":
            windows = manual_clip(start, end, duration)
        elif strategy == "fixed-interval":
            windows = fixed_interval_clips(
                start, end, duration,
                int(settings.get("clipCount", 5)),
                float(settings.get("clipDurationSeconds", 30)),
            )
        elif strategy == "ai-highlights":
            temp_audio = str(job_output_dir / "temp_audio.wav")
            job["currentOperation"] = "Extracting audio"
            extract_audio(video_path, temp_audio)

            job["currentOperation"] = "Transcribing speech"
            transcript = transcribe_audio(temp_audio)

            job["currentOperation"] = "Analyzing audio energy"
            energy = score_energy(temp_audio)

            content_moments = []
            if transcript and os.environ.get("ANTHROPIC_API_KEY"):
                job["currentOperation"] = "Scoring content for interesting moments"
                content_moments = score_content(transcript)

            windows = rank_clips(content_moments, energy, duration,
                                  int(settings.get("clipCount", 5)))
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

        if not windows:
            job["status"] = "failed"
            job["error"] = "No clips could be produced from these settings."
            return

        results = []
        total = len(windows)
        for i, w in enumerate(windows, start=1):
            if job.get("cancel_requested"):
                job["status"] = "cancelled"
                return

            job["status"] = "exporting"
            ext = {"mp4": "mp4", "mov": "mov", "webm": "webm"}.get(output_format, "mp4")
            filename = f"clip_{i}.{ext}"
            out_path = job_output_dir / filename
            job["currentFile"] = filename
            job["currentOperation"] = f"Exporting clip {i} of {total}"
            job["progress"] = round((i - 1) / total, 3)

            cut_clip_with_settings(video_path, w["start"], w["end"], str(out_path),
                                    output_format=output_format, quality=quality,
                                    aspect_ratio=aspect_ratio)

            clip_meta = probe_video(str(out_path))
            results.append({
                "id": uuid.uuid4().hex[:8],
                "jobId": job_id,
                "fileName": filename,
                "filePath": str(out_path.resolve()),
                "durationSeconds": clip_meta["durationSeconds"],
                "width": clip_meta["width"],
                "height": clip_meta["height"],
                "sizeBytes": out_path.stat().st_size,
                "thumbnailUrl": None,
                "startSeconds": w["start"],
                "endSeconds": w["end"],
            })
            job["progress"] = round(i / total, 3)

        if temp_audio:
            Path(temp_audio).unlink(missing_ok=True)

        job["clips"] = results
        job["status"] = "completed"
        job["currentOperation"] = None
        job["currentFile"] = None
        job["progress"] = 1.0

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)


@app.route("/api/probe", methods=["POST"])
def api_probe():
    data = request.get_json() or {}
    video_path = data.get("video_path", "").strip()
    if not video_path or not Path(video_path).exists():
        return jsonify({"error": f"File not found: {video_path}"}), 400
    try:
        return jsonify(probe_video(video_path))
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/create_clips", methods=["POST"])
def api_create_clips():
    data = request.get_json() or {}
    video_path = data.get("video_path", "").strip()
    settings = data.get("settings", {})

    if not video_path:
        return jsonify({"error": "No video path provided."}), 400
    if not Path(video_path).exists():
        return jsonify({"error": f"File not found: {video_path}"}), 400

    job_id = uuid.uuid4().hex[:8]
    ENGINE_JOBS[job_id] = {
        "status": "queued", "progress": 0.0, "currentOperation": "Queued",
        "currentFile": None, "error": None, "clips": [], "cancel_requested": False,
    }

    thread = threading.Thread(target=run_engine_job, args=(job_id, video_path, settings), daemon=True)
    thread.start()

    return jsonify({"job_id": job_id})


@app.route("/api/engine_status/<job_id>")
def api_engine_status(job_id):
    job = ENGINE_JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Unknown job id"}), 404
    return jsonify({k: v for k, v in job.items() if k != "cancel_requested"})


@app.route("/api/cancel/<job_id>", methods=["POST"])
def api_cancel(job_id):
    job = ENGINE_JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Unknown job id"}), 404
    job["cancel_requested"] = True
    return jsonify({"ok": True})


@app.route("/api/reveal", methods=["POST"])
def api_reveal():
    data = request.get_json() or {}
    file_path = data.get("file_path", "").strip()
    if not file_path:
        return jsonify({"error": "No file_path provided."}), 400
    target = Path(file_path)
    folder = target.parent if target.is_file() else target
    ok, err = _reveal_path(folder)
    if not ok:
        return jsonify({"error": err, "path": str(folder)}), 400
    return jsonify({"ok": True})


@app.route("/api/browse", methods=["POST"])
def browse():
    """Opens a native file-picker dialog on the machine running the server."""
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askopenfilename(
            title="Select a video",
            filetypes=[("Video files", "*.mp4 *.mov *.mkv *.avi *.webm"), ("All files", "*.*")],
        )
        root.destroy()
        if not path:
            return jsonify({"path": None})
        return jsonify({"path": path})
    except Exception as e:
        return jsonify({"error": f"Native file picker unavailable ({e}). Paste the file path manually."}), 400


@app.route("/api/process", methods=["POST"])
def process():
    data = request.get_json()
    video_path = (data or {}).get("video_path", "").strip()
    num_clips = int((data or {}).get("num_clips", 5))

    if not video_path:
        return jsonify({"error": "No video path provided."}), 400
    if not Path(video_path).exists():
        return jsonify({"error": f"File not found: {video_path}"}), 400

    job_id = uuid.uuid4().hex[:8]
    JOBS[job_id] = {"status": "running", "step": "Queued...", "log": [], "clips": [], "error": None}

    thread = threading.Thread(target=run_pipeline, args=(job_id, video_path, num_clips), daemon=True)
    thread.start()

    return jsonify({"job_id": job_id})


@app.route("/api/status/<job_id>")
def status(job_id):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Unknown job id"}), 404
    return jsonify(job)


@app.route("/api/output/<job_id>/<filename>")
def serve_clip(job_id, filename):
    folder = OUTPUT_DIR / job_id
    return send_from_directory(folder, filename)


@app.route("/api/open_output/<job_id>", methods=["POST"])
def open_output(job_id):
    folder = OUTPUT_DIR / job_id
    try:
        if sys.platform == "win32":
            os.startfile(folder)
        elif sys.platform == "darwin":
            subprocess.run(["open", str(folder)])
        else:
            subprocess.run(["xdg-open", str(folder)])
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e), "path": str(folder)}), 400


if __name__ == "__main__":
    port = int(os.environ.get("CLIPPER_BACKEND_PORT", 5050))
    if not os.environ.get("CLIPPER_NO_BROWSER"):
        threading.Timer(1.0, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    print(f"Clipper backend running at http://127.0.0.1:{port}  (Ctrl+C to stop)")
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
