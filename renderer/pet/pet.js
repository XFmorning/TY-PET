const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: true });

let currentAnim = null;
let ratioSet = false;
let clickPending = false;

// ===== Canvas 渲染循环 =====
function renderFrame() {
  // 只有视频有了有效帧才更新 canvas（否则保留上一帧，消除闪屏）
  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0);
  }
  requestAnimationFrame(renderFrame);
}
renderFrame();

// ===== 等比例锁定 =====
video.addEventListener('loadedmetadata', () => {
  if (!ratioSet && video.videoWidth && video.videoHeight) {
    ratioSet = true;
    window.petAPI.setAspectRatio(video.videoWidth / video.videoHeight);
  }
});

// ===== 对话气泡（独立窗口，文本从后台读取） =====

// ===== 播放动画 =====
window.petAPI.onPlay((anim) => {
  currentAnim = anim;
  video.src = anim.resolvedSrc;
  video.loop = !!anim.loop;
  video.play().catch(() => {});

  if (anim.speechText) window.petAPI.showSpeech(anim.speechText);
});

video.addEventListener('ended', () => {
  if (currentAnim && currentAnim.state !== 'idle') {
    window.petAPI.animationEnded();
  } else if (currentAnim && currentAnim.state === 'idle') {
    video.currentTime = 0;
    video.play().catch(() => {});
  }
});

window.petAPI.onReset(() => {
  video.currentTime = 0;
  video.play().catch(() => {});
});

// ===== 关闭按钮 =====
document.getElementById('closeBtn').addEventListener('click', () => {
  window.petAPI.hideWindow();
});

// ===== 交互 =====
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petAPI.openContextMenu(e.screenX, e.screenY);
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) clickPending = true;
});

canvas.addEventListener('mouseup', (e) => {
  if (e.button === 0 && clickPending) {
    clickPending = false;
    window.petAPI.onClick();
  }
});

canvas.addEventListener('mousemove', () => {
  clickPending = false;
});

// ===== 透明区域点击穿透 =====
let lastClickThrough = true;

function checkTransparentClickThrough(x, y) {
  // 只在视频渲染完成后检查
  if (video.readyState < 2 || !canvas.width) return;
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const transparent = pixel[3] < 10;
  if (transparent !== lastClickThrough) {
    lastClickThrough = transparent;
    window.petAPI.setClickThrough(transparent);
  }
}

// 鼠标移动时实时检测像素透明度
canvas.addEventListener('mousemove', throttle((e) => {
  checkTransparentClickThrough(e.offsetX, e.offsetY);
}, 30));

// 鼠标离开画布时恢复穿透
canvas.addEventListener('mouseleave', () => {
  if (!lastClickThrough) {
    lastClickThrough = true;
    window.petAPI.setClickThrough(true);
  }
});

// 简单的 throttle 工具
function throttle(fn, delay) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn.apply(this, args);
    }
  };
}
