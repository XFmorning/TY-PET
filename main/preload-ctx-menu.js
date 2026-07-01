const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('menuAPI', {
  trigger: (animId) => ipcRenderer.send('ctx:trigger', animId),
  hide: () => ipcRenderer.send('ctx:hide'),
  settings: () => ipcRenderer.send('ctx:settings'),
  quit: () => ipcRenderer.send('ctx:quit'),
  close: () => ipcRenderer.send('ctx:close'),
});
