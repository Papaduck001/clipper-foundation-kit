/**
 * Clipper desktop main process.
 *
 * This is the only place where real video processing happens: it runs the
 * bundled FFmpeg binary against local files. The React UI talks to it through
 * the IPC surface exposed in preload.cjs.
 *
 * The ffmpeg cutting arguments are ported from the Python prototype
 * (src/cutter.py: -ss <start> -i <file> -t <duration> -c:v libx264 -c:a aac).
 */
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

/** Resolve a binary that ships inside the asar-unpacked node_modules. */
function resolveBinary(mod) {
  let p;
  try {
    p = require(mod);
  } catch {
    return null;
  }
  if (typeof p !== "string" && p && p.path) p = p.path;
  if (typeof p !== "string") return null;
  return p.replace("app.asar", "app.asar.unpacked");
}

const FFMPEG = resolveBinary("ffmpeg-static") || "ffmpeg";
const FFPROBE = (() => {
  try {
    const s = require("ffprobe-static");
    return (s.path || s).replace("app.asar", "app.asar.unpacked");
  } catch {
    return "ffprobe";
  }
})();

const running = new Map(); // jobId -> child process

function humanizeFfmpegError(stderr, fallback) {
  const text = (stderr || "").trim();
  if (/No such file or directory/i.test(text)) return "The video file could not be found on disk.";
  if (/Permission denied/i.test(text)) return "Permission denied writing to the output folder.";
  if (/No space left on device/i.test(text)) return "Not enough free disk space to write the clip.";
  if (/Invalid data found|moov atom not found|could not find codec/i.test(text))
    return "The video file appears to be corrupted or uses an unsupported format.";
  const last = text.split("\n").filter(Boolean).slice(-2).join(" ");
  return last || fallback;
}

function runFfprobe(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return reject(new Error("The video file could not be found."));
    const child = spawn(FFPROBE, [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", () => reject(new Error("FFmpeg is not available in this installation.")));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(humanizeFfmpegError(err, "Could not read the video.")));
      let data;
      try {
        data = JSON.parse(out);
      } catch {
        return reject(new Error("Could not read the video metadata."));
      }
      const video = (data.streams || []).find((s) => s.codec_type === "video");
      const audio = (data.streams || []).find((s) => s.codec_type === "audio");
      if (!video) return reject(new Error("This file does not contain a video track."));
      const fpsParts = String(video.avg_frame_rate || "0/0").split("/");
      const fps = Number(fpsParts[1]) > 0 ? Number(fpsParts[0]) / Number(fpsParts[1]) : null;
      resolve({
        durationSeconds: Number(data.format?.duration ?? 0),
        width: Number(video.width ?? 0),
        height: Number(video.height ?? 0),
        frameRate: fps && Number.isFinite(fps) ? Math.round(fps * 100) / 100 : null,
        videoCodec: video.codec_name ?? null,
        audioCodec: audio?.codec_name ?? null,
        bitrateKbps: data.format?.bit_rate ? Math.round(Number(data.format.bit_rate) / 1000) : null,
      });
    });
  });
}

const CRF = { low: 32, medium: 26, high: 20, source: 18 };
const RATIO = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5 };

function encodeArgs(settings) {
  const args = [];
  if (settings.aspectRatio !== "source" && RATIO[settings.aspectRatio]) {
    const r = RATIO[settings.aspectRatio];
    args.push(
      "-vf",
      `crop='min(iw,ih*${r})':'min(ih,iw/${r})',scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    );
  }
  if (settings.outputFormat === "webm") {
    args.push("-c:v", "libvpx-vp9", "-crf", String(CRF[settings.outputQuality] ?? 20), "-b:v", "0");
    args.push("-c:a", "libopus");
  } else {
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", String(CRF[settings.outputQuality] ?? 20));
    args.push("-c:a", "aac");
  }
  return args;
}

function cutClip({ jobId, sourcePath, outPath, start, duration, settings, onProgress }) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-ss",
      String(start),
      "-i",
      sourcePath,
      "-t",
      String(duration),
      ...encodeArgs(settings),
      "-progress",
      "pipe:1",
      "-nostats",
      "-loglevel",
      "error",
      outPath,
    ];
    const child = spawn(FFMPEG, args);
    running.set(jobId, child);
    let err = "";
    child.stdout.on("data", (chunk) => {
      const match = /out_time_us=(\d+)/g;
      let m;
      let last = null;
      while ((m = match.exec(String(chunk)))) last = Number(m[1]);
      if (last !== null && duration > 0) onProgress(Math.min(1, last / 1e6 / duration));
    });
    child.stderr.on("data", (d) => (err += d));
    child.on("error", () => reject(new Error("FFmpeg could not be started.")));
    child.on("close", (code, signal) => {
      running.delete(jobId);
      if (signal) return reject(Object.assign(new Error("Job cancelled."), { cancelled: true }));
      if (code !== 0) return reject(new Error(humanizeFfmpegError(err, "FFmpeg failed to cut the clip.")));
      resolve();
    });
  });
}

async function createClips(event, { jobId, sourcePath, plan, settings, sourceName }) {
  if (!sourcePath) throw new Error("No file path for this video. Use “Browse files” to pick it.");
  if (!fs.existsSync(sourcePath)) throw new Error("The source video no longer exists on disk.");
  if (!plan.length) throw new Error("The current settings produce no clips.");

  const outputDir =
    settings.outputDirectory || path.join(app.getPath("videos") || os.homedir(), "Clipper");
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.accessSync(outputDir, fs.constants.W_OK);
  } catch {
    throw new Error(`Cannot write to the output folder: ${outputDir}`);
  }

  const base = path.parse(sourceName || path.basename(sourcePath)).name.replace(/[^\w.-]+/g, "_");
  const metadata = await runFfprobe(sourcePath);
  const results = [];

  for (let i = 0; i < plan.length; i++) {
    const clip = plan[i];
    const fileName = `${base}_clip_${String(i + 1).padStart(2, "0")}.${settings.outputFormat}`;
    const outPath = path.join(outputDir, fileName);
    event.sender.send("clips:progress", {
      jobId,
      progress: i / plan.length,
      currentOperation: `Cutting clip ${i + 1} of ${plan.length}`,
      currentFile: outPath,
    });
    await cutClip({
      jobId,
      sourcePath,
      outPath,
      start: clip.start,
      duration: clip.end - clip.start,
      settings,
      onProgress: (frac) =>
        event.sender.send("clips:progress", {
          jobId,
          progress: (i + frac) / plan.length,
          currentOperation: `Cutting clip ${i + 1} of ${plan.length}`,
          currentFile: outPath,
        }),
    });

    let size = null;
    try {
      size = fs.statSync(outPath).size;
    } catch {
      /* ignore */
    }
    let out = { width: metadata.width, height: metadata.height, durationSeconds: clip.end - clip.start };
    try {
      const probed = await runFfprobe(outPath);
      out = {
        width: probed.width,
        height: probed.height,
        durationSeconds: probed.durationSeconds || out.durationSeconds,
      };
    } catch {
      /* keep source dimensions */
    }
    results.push({
      fileName,
      filePath: outPath,
      sizeBytes: size,
      startSeconds: clip.start,
      endSeconds: clip.end,
      ...out,
    });
  }
  return { outputDir, clips: results };
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: "#0b0b0e",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadURL(url);
}

/** Start the bundled app server (production) or use the dev server. */
async function startServer() {
  const devUrl = process.env.CLIPPER_DEV_URL;
  if (devUrl) return devUrl;
  const port = 41730 + Math.floor(Math.random() * 200);
  process.env.PORT = String(port);
  process.env.HOST = "127.0.0.1";
  const entry = path.join(process.resourcesPath || path.join(__dirname, ".."), "app-server", "index.mjs");
  const local = path.join(__dirname, "..", ".output", "server", "index.mjs");
  const file = fs.existsSync(entry) ? entry : local;
  await import(`file://${file}`);
  return `http://127.0.0.1:${port}`;
}

app.whenReady().then(async () => {
  ipcMain.handle("engine:available", async () => {
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(FFMPEG, ["-version"]);
        child.on("error", reject);
        child.on("close", (c) => (c === 0 ? resolve() : reject(new Error("ffmpeg failed"))));
      });
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle("video:probe", (_e, filePath) => runFfprobe(filePath));
  ipcMain.handle("video:select", async () => {
    const res = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Video", extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v"] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const filePath = res.filePaths[0];
    const stat = fs.statSync(filePath);
    return { path: filePath, name: path.basename(filePath), sizeBytes: stat.size };
  });
  ipcMain.handle("folder:select", async () => {
    const res = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    return res.canceled ? null : res.filePaths[0];
  });
  ipcMain.handle("clips:create", (event, payload) => createClips(event, payload));
  ipcMain.handle("clips:cancel", (_e, jobId) => {
    const child = running.get(jobId);
    if (child) child.kill("SIGKILL");
    return true;
  });
  ipcMain.handle("file:reveal", (_e, p) => shell.showItemInFolder(p));
  ipcMain.handle("file:open", (_e, p) => shell.openPath(p));
  ipcMain.handle("clipboard:write", (_e, text) => clipboard.writeText(text));

  createWindow(await startServer());
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(await startServer());
  });
});

app.on("window-all-closed", () => {
  for (const child of running.values()) child.kill("SIGKILL");
  if (process.platform !== "darwin") app.quit();
});
