const { powerMonitor } = require('electron');

let pollTimer = null;
let prevIdleTime = 0;
let consecutiveKeyLike = 0;

// 通过系统空闲时间 + 连续活动检测键盘输入
// 安全机制限制下无法直接读键盘状态，用启发式方法
function startKeyboardMonitor(onKeyPress) {
  prevIdleTime = powerMonitor.getSystemIdleTime();

  pollTimer = setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();

    // 空闲时间没增加 → 有用户活动
    if (idle <= prevIdleTime + 0.5) {
      consecutiveKeyLike++;
    } else {
      consecutiveKeyLike = 0;
    }

    // 连续4秒都有活动才认定为打字
    if (consecutiveKeyLike >= 4) {
      consecutiveKeyLike = 0;
      onKeyPress();
    }

    prevIdleTime = idle;
  }, 1000);

  return pollTimer;
}

function stopKeyboardMonitor(timer) {
  if (timer) clearInterval(timer);
  consecutiveKeyLike = 0;
  pollTimer = null;
}

module.exports = { startKeyboardMonitor, stopKeyboardMonitor };
