#!/usr/bin/env python3
"""
Clipper CLI — turn a long video into short highlight clips.

Usage:
    python clip.py myvideo.mp4 --clips 5
"""
import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv
import librosa

from src.audio_extract import extract_audio
from src.transcribe import transcribe_audio
from src.audio_energy import score_energy
from src.content_score import score_content
from src.ranker import rank_clips
from src.cutter import cut_clips

load_dotenv()


def main():
    parser = argparse.ArgumentParser(description="Auto-clip a long video into short highlights.")
    parser.add_argument("video", help="Path to the source video file")
    parser.add_argument("--clips", type=int, default=5, help="Number of clips to produce (default: 5)")
    parser.add_argument("--output", default="output", help="Output folder (default: ./output)")
    args = parser.parse_args()

    if not Path(args.video).exists():
        print(f"Error: video file not found: {args.video}")
        sys.exit(1)

    temp_audio = "temp_audio.wav"

    try:
        print("[1/5] Extracting audio...")
        extract_audio(args.video, temp_audio)

        print("[2/5] Transcribing speech...")
        transcript = transcribe_audio(temp_audio)
        if transcript:
            print(f"       Found {len(transcript)} speech segments.")
        else:
            print("       No speech detected — will rank clips by audio energy only.")

        print("[3/5] Analyzing audio energy...")
        energy = score_energy(temp_audio)

        print("[4/5] Scoring content for interesting moments...")
        content_moments = score_content(transcript) if transcript else []

        duration = librosa.get_duration(path=temp_audio)
        ranked = rank_clips(content_moments, energy, duration, args.clips)

        if not ranked:
            print("No suitable clips could be identified. Try a longer or louder video.")
            sys.exit(0)

        print(f"[5/5] Cutting {len(ranked)} clip(s)...")
        files = cut_clips(args.video, ranked, args.output)

        print("\nDone! Clips saved:")
        for f, c in zip(files, ranked):
            reason = f" — {c['reason']}" if c.get("reason") else ""
            print(f"  {f}  [{c['start']}s - {c['end']}s]  score={c['score']}{reason}")

    finally:
        Path(temp_audio).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
