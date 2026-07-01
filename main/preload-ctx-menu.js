const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('menuAPI', {
  trigger: (animId) => ipcRenderer.send('ctx:trigger', animId),
  hide: () => ipcRenderer.send('ctx:hide'),
  settings: () => ipcRenderer.send('ctx:settings'),
  quit: () => ipcRenderer.send('ctx:quit'),
  close: () => ipcRenderer.send('ctx:close'),
  chat: () => ipcRenderer.send('ctx:chat'),
  toggleAi: () => ipcRenderer.send('ctx:toggle-ai'),
  onAiState: (cb) => {
    ipcRenderer.on('ctx:ai-state', (_e, v) => cb(v));
  },
  getAiState: () => ipcRenderer.invoke('ctx:get-ai-state'),
});
