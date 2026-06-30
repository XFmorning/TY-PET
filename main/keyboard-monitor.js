const { powerMonitor } = require('electron');

let pollTimer = null;
let prevIdleTime = 0;

// 通过系统空闲时间检测用户活动（不拦截任何输入）
function startKeyboardMonitor(onUserActive) {
  prevIdleTime = powerMonitor.getSystemIdleTime();

  pollTimer = setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();
    // 空闲时间突然变小 = 用户有输入（键盘/鼠标）
    if (idle < prevIdleTime) {
      onUserActive();
    }
    prevIdleTime = idle;
  }, 300);

  return pollTimer;
}

function stopKeyboardMonitor(timer) {
  if (timer) clearInterval(timer);
  pollTimer = null;
}

module.exports = { startKeyboardMonitor, stopKeyboardMonitor };
