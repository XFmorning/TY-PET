const { powerMonitor } = require('electron');
const { spawnSync } = require('child_process');
const path = require('path');

// 前台是打字软件时才触发
const TYPING_PROCS = [
  // 浏览器
  'chrome', 'msedge', 'firefox', 'opera', 'brave', 'vivaldi', 'chromium',
  // 编辑器/IDE
  'code', 'notepad++', 'sublime_text', 'atom', 'vim', 'nvim',
  'idea64', 'webstorm64', 'pycharm64', 'clion64', 'rider64', 'goland64',
  'eclipse', 'androidstudio', 'xcode',
  // 办公
  'WINWORD', 'EXCEL', 'ONENOTE', 'OUTLOOK', 'POWERPNT',
  'notepad', 'wordpad', 'wps', 'wpp', 'et',
  // 聊天
  'WeChat', 'WeChatAppEx', 'qq', 'TIM', 'dingtalk', 'lark',
  'slack', 'discord', 'telegram', 'whatsapp',
  // 终端
  'cmd', 'powershell', 'WindowsTerminal', 'mintty', 'bash',
  // 笔记
  'Obsidian', 'Notion', 'evernote', 'typora', 'marktext',
  // 其他
  'foxmail', 'thunderbird', 'postman', 'dbvis'
];

const FG_APP = path.join(__dirname, 'ForegroundApp.exe');
let pollTimer = null;
let matchCount = 0;

function getForegroundProcess() {
  try {
    const result = spawnSync(FG_APP, [], { timeout: 2000, encoding: 'utf-8' });
    return (result.stdout || '').trim().toLowerCase();
  } catch { return ''; }
}

function startKeyboardMonitor(onKeyPress) {
  pollTimer = setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();

    // 空闲超过3秒 → 用户没有输入 → 重置计数
    if (idle >= 3) {
      matchCount = 0;
      return;
    }

    // 检查前台是否打字软件
    const proc = getForegroundProcess();
    if (!proc) { matchCount = 0; return; }

    if (TYPING_PROCS.includes(proc)) {
      matchCount++;
      // 连续2次匹配（2秒）才触发
      if (matchCount >= 2) {
        matchCount = 0;
        onKeyPress();
      }
    } else {
      matchCount = 0;
    }
  }, 1000);

  return pollTimer;
}

function stopKeyboardMonitor(timer) {
  if (timer) clearInterval(timer);
  matchCount = 0;
  pollTimer = null;
}

module.exports = { startKeyboardMonitor, stopKeyboardMonitor };
