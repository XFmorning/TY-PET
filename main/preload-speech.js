const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bubbleAPI', {
  onText: (cb) => ipcRenderer.on('bubble:text', (_e, text) => cb(text)),
  resize: (w) => ipcRenderer.send('bubble:resize', w),
});
