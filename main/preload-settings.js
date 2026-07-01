const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  getAll: () => ipcRenderer.invoke('settings:getAll'),
  set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  onStateChange: (callback) => {
    ipcRenderer.on('pet:state-change', (_event, state) => callback(state));
  },
  preview: (animId) => {
    ipcRenderer.send('pet:preview', animId);
  }
});
