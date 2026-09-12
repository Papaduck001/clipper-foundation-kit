/** Bridges the renderer (React UI) to the FFmpeg-backed main process. */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("clipper", {
  isDesktop: true,
  engineAvailable: () => ipcRenderer.invoke("engine:available"),
  probe: (filePath) => ipcRenderer.invoke("video:probe", filePath),
  selectVideo: () => ipcRenderer.invoke("video:select"),
  selectOutputFolder: () => ipcRenderer.invoke("folder:select"),
  createClips: (payload) => ipcRenderer.invoke("clips:create", payload),
  cancelJob: (jobId) => ipcRenderer.invoke("clips:cancel", jobId),
  revealFile: (filePath) => ipcRenderer.invoke("file:reveal", filePath),
  openFile: (filePath) => ipcRenderer.invoke("file:open", filePath),
  copyText: (text) => ipcRenderer.invoke("clipboard:write", text),
  onProgress: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("clips:progress", listener);
    return () => ipcRenderer.removeListener("clips:progress", listener);
  },
});
