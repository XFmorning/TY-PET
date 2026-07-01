const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chatAPI', {
  send: (text) => ipcRenderer.send('chat:message', text),
  close: () => ipcRenderer.send('chat:close'),
  resize: (w) => ipcRenderer.send('chat:resize', w),
  onFocus: (cb) => ipcRenderer.on('chat:focus', () => cb()),
});
