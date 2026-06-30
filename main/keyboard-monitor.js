const { globalShortcut } = require('electron');

// 注册所有打字常用键的全局快捷键
const TYPING_KEYS = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  '0','1','2','3','4','5','6','7','8','9',
  'Space','Enter','Backspace','Tab','Delete'
];

let callbacks = [];

function startKeyboardMonitor(onKeyPress) {
  callbacks.push(onKeyPress);

  if (callbacks.length === 1) {
    // 首次调用才注册快捷键
    for (const key of TYPING_KEYS) {
      try {
        globalShortcut.register(key, () => {
          for (const cb of callbacks) cb();
        });
      } catch (e) {
        // 忽略单个键注册失败
      }
    }
  }
}

function stopKeyboardMonitor() {
  globalShortcut.unregisterAll();
  callbacks = [];
}

module.exports = { startKeyboardMonitor, stopKeyboardMonitor };
