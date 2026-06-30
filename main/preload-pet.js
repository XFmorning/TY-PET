const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  onPlay: (callback) => {
    ipcRenderer.on('pet:play', (_event, anim) => callback(anim));
  },
  onClick: () => {
    ipcRenderer.send('pet:click');
  },
  animationEnded: () => {
    ipcRenderer.send('pet:animation-ended');
  },
  onStateChange: (callback) => {
    ipcRenderer.on('pet:state-change', (_event, state) => callback(state));
  },
  onReset: (callback) => {
    ipcRenderer.on('pet:reset', () => callback());
  },
  setAspectRatio: (ratio) => {
    ipcRenderer.send('pet:set-aspect-ratio', ratio);
  },
  hideWindow: () => {
    ipcRenderer.send('pet:hide');
  },
  openContextMenu: (x, y) => {
    ipcRenderer.send('pet:context-menu', x, y);
  },
  showSpeech: (text) => {
    ipcRenderer.send('pet:show-speech', text);
  }
});
