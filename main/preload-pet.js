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
  showContextMenu: (screenX, screenY) => {
    ipcRenderer.send('pet:show-ctx-menu', screenX, screenY);
  },
  openContextMenu: (x, y) => {
    ipcRenderer.send('pet:context-menu', x, y);
  },
  videoDuration: (state, duration) => {
    ipcRenderer.send('pet:video-duration', state, duration);
  },
  moveWindow: (x, y) => {
    ipcRenderer.send('pet:move-window', x, y);
  },
  saveSize: () => {
    ipcRenderer.send('pet:save-size');
  },
  triggerAnimation: (animId) => {
    ipcRenderer.send('pet:preview', animId);
  },
  showSettings: () => {
    ipcRenderer.send('pet:show-settings');
  },
  quitApp: () => {
    ipcRenderer.send('pet:quit');
  },
});
