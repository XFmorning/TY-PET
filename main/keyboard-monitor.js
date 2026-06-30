const { globalShortcut } = require('electron');

// 只注册字母键，不拦截输入（Windows RegisterHotKey 不吞噬按键）
const LETTER_KEYS = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
];

let callbacks = [];
let registered = false;

function startKeyboardMonitor(onLetterKey) {
  callbacks.push(onLetterKey);
  if (registered) return;
  registered = true;

  for (const key of LETTER_KEYS) {
    try {
      globalShortcut.register(key, () => {
        for (const cb of callbacks) cb();
      });
    } catch (e) {
      // 忽略单个键注册失败
    }
  }
}

function stopKeyboardMonitor() {
  globalShortcut.unregisterAll();
  callbacks = [];
  registered = false;
}

module.exports = { startKeyboardMonitor, stopKeyboardMonitor };
