const koffi = require('koffi');

// 绑定 Win32 GetAsyncKeyState（只读查询按键状态，不拦截输入）
const lib = koffi.load('user32.dll');
const GetAsyncKeyState = lib.func('GetAsyncKeyState', 'short', ['int']);

// 需要检测的打字相关按键
const TYPING_KEYS = (() => {
  const keys = [];
  for (let i = 0x41; i <= 0x5A; i++) keys.push(i);          // A-Z
  for (let i = 0x30; i <= 0x39; i++) keys.push(i);          // 0-9
  for (let i = 0x60; i <= 0x69; i++) keys.push(i);          // 小键盘
  keys.push(
    0x20, 0x0D, 0x08, 0x09,                                  // Space Enter Back Tab
    0xBD, 0xBB, 0xDB, 0xDD, 0xBA, 0xDE, 0xBC, 0xBE, 0xBF, 0xDC, 0xC0
  );
  return keys;
})();

const SAMPLE_MS = 50;

// ========== 按键边缘检测 + 按键计数 ==========
let prevDown = new Array(TYPING_KEYS.length).fill(false);
let keystrokeAccumulator = 0;

// ========== 滚动窗口（判定是否正在打字） ==========
const WINDOW_SIZE = 20;        // 20 个样本 ≈ 1 秒
const ACTIVITY_THRESHOLD = 5;  // ≥5 活跃样本 → 打字中
let ringBuffer = new Array(WINDOW_SIZE).fill(0);
let ringIndex = 0;
let activeSum = 0;

// ========== 上次按键时间（用于空闲超时判定） ==========
let lastKeyTime = 0;

let pollTimer = null;

// 单次采样：返回本次是否检测到新按键
function sample() {
  let newPresses = 0;
  let anyDown = false;

  for (let i = 0; i < TYPING_KEYS.length; i++) {
    const down = !!(GetAsyncKeyState(TYPING_KEYS[i]) & 0x8000);
    if (down && !prevDown[i]) newPresses++;  // 上升沿检测 = 一次按键
    if (down) anyDown = true;
    prevDown[i] = down;
  }

  if (newPresses > 0) keystrokeAccumulator += newPresses;
  if (anyDown) lastKeyTime = Date.now();

  return anyDown;
}

// 重置按键计数
function resetKeystrokes() { keystrokeAccumulator = 0; }

// 获取累计按键次数
function getKeystrokes() { return keystrokeAccumulator; }

// 距离最后一次按键过去了多少毫秒
function getIdleMs() {
  if (lastKeyTime === 0) return Infinity;
  return Date.now() - lastKeyTime;
}

function startKeyboardMonitor(onKeyPress) {
  ringBuffer.fill(0);
  ringIndex = 0;
  activeSum = 0;
  prevDown.fill(false);
  keystrokeAccumulator = 0;
  lastKeyTime = 0;

  pollTimer = setInterval(() => {
    activeSum -= ringBuffer[ringIndex];
    const active = sample() ? 1 : 0;
    ringBuffer[ringIndex] = active;
    activeSum += active;
    ringIndex = (ringIndex + 1) % WINDOW_SIZE;

    if (activeSum >= ACTIVITY_THRESHOLD) {
      ringBuffer.fill(0);
      ringIndex = 0;
      activeSum = 0;
      onKeyPress();
    }
  }, SAMPLE_MS);

  return pollTimer;
}

function stopKeyboardMonitor(timer) {
  if (timer) clearInterval(timer);
  ringBuffer.fill(0);
  ringIndex = 0;
  activeSum = 0;
  prevDown.fill(false);
  keystrokeAccumulator = 0;
  lastKeyTime = 0;
  pollTimer = null;
}

module.exports = {
  startKeyboardMonitor,
  stopKeyboardMonitor,
  getKeystrokes,
  resetKeystrokes,
  getIdleMs
};
