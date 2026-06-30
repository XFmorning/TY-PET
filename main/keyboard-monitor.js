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
    if (idle <= prevIdleTime + 0.2) {
      consecutiveKeyLike++;
    } else {
      consecutiveKeyLike = 0;
    }

    // 连续采样到活动2次以上才认定为"打字"
    if (consecutiveKeyLike === 3) {
      onKeyPress();
    }

    prevIdleTime = idle;
  }, 300);

  return pollTimer;
}

function stopKeyboardMonitor(timer) {
  if (timer) clearInterval(timer);
  consecutiveKeyLike = 0;
  pollTimer = null;
}

module.exports = { startKeyboardMonitor, stopKeyboardMonitor };
