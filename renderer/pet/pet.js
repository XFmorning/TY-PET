const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: true });
const dragDot = document.getElementById('dragDot');

let currentAnim = null;
let ratioSet = false;
let clickPending = false;
let canvasLocked = false;
let pickupActive = false;
let dragActive = false;
let dragPending = false;
let dragOffsetX = 0, dragOffsetY = 0;
let dragStartX = 0, dragStartY = 0;

// 主 video 渲染还是拖放 video 渲染
let useDragVideo = false;
let dragVideo = null;    // 当前活动的拖放 video（pickup 或 putdown）

// 预加载拎起来 / 放下去 video（脱离 DOM，不会触发窗口重排）
const pickupVideo = document.createElement('video');
pickupVideo.src = '拎起来.webm';
pickupVideo.preload = 'auto';
pickupVideo.loop = false;
pickupVideo.muted = true;

const putdownVideo = document.createElement('video');
putdownVideo.src = '放下去.webm';
putdownVideo.preload = 'auto';
putdownVideo.loop = false;
putdownVideo.muted = true;

let putdownEndedHandler = null; // 放下去 ended 监听器引用，用于清理

// ===== Canvas 渲染循环 =====
function renderFrame() {
  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    if (!canvasLocked) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvasLocked = true;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const src = useDragVideo ? dragVideo : video;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(renderFrame);
}
renderFrame();

// ===== 等比例锁定 + 视频时长上报 =====
video.addEventListener('loadedmetadata', () => {
  if (!ratioSet && video.videoWidth && video.videoHeight) {
    ratioSet = true;
    window.petAPI.setAspectRatio(video.videoWidth / video.videoHeight);
  }
  if (currentAnim && video.duration && isFinite(video.duration)) {
    window.petAPI.videoDuration(currentAnim.state, video.duration);
  }
});

// ===== 播放动画 =====
window.petAPI.onPlay((anim) => {
  if (pickupActive) return;
  pickupActive = false;
  useDragVideo = false;
  currentAnim = anim;
  video.src = anim.resolvedSrc;
  video.loop = !!anim.loop;
  video.play().catch(() => {});

  if (anim.speechText) window.petAPI.showSpeech(anim.speechText, !!anim.forceSpeech);
});

video.addEventListener('ended', () => {
  if (pickupActive) return;
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

// ===== 点击（打招呼） =====
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petAPI.openContextMenu(e.screenX, e.screenY);
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) clickPending = true;
});

canvas.addEventListener('mousemove', () => {
  clickPending = false;
});

canvas.addEventListener('mouseup', (e) => {
  if (e.button === 0 && clickPending) {
    clickPending = false;
    window.petAPI.onClick();
  }
});

// ===== 拎起来 / 放下去（使用预加载的 off-DOM video） =====
function startPickup() {
  // 清理之前残留的放下去监听
  if (putdownEndedHandler) {
    putdownVideo.removeEventListener('ended', putdownEndedHandler);
    putdownEndedHandler = null;
  }
  putdownVideo.pause();

  // 保存当前窗口尺寸，拖放结束后恢复
  window.petAPI.saveSize();

  pickupActive = true;
  useDragVideo = true;
  dragVideo = pickupVideo;
  pickupVideo.currentTime = 0;
  pickupVideo.play().catch(() => {});
}

function startPutdown() {
  pickupActive = false;
  useDragVideo = true;
  dragVideo = putdownVideo;
  putdownVideo.currentTime = 0;
  putdownVideo.play().catch(() => {});

  // 清除旧监听后注册新监听
  if (putdownEndedHandler) {
    putdownVideo.removeEventListener('ended', putdownEndedHandler);
  }
  putdownEndedHandler = () => {
    putdownEndedHandler = null;
    if (!pickupActive) {
      useDragVideo = false;
      window.petAPI.animationEnded();
    }
  };
  putdownVideo.addEventListener('ended', putdownEndedHandler);
}

function dragEnd() {
  dragPending = false;
  dragActive = false;
  if (pickupActive) startPutdown();
}

// ===== 拖放 =====
dragDot.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.stopPropagation();
  dragDot.setPointerCapture(e.pointerId);

  dragPending = true;
  dragOffsetX = e.screenX - window.screenX;
  dragOffsetY = e.screenY - window.screenY;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
});

dragDot.addEventListener('pointermove', (e) => {
  if (!dragPending && !dragActive) return;

  if (!dragActive) {
    const dx = e.screenX - dragStartX;
    const dy = e.screenY - dragStartY;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    dragActive = true;
    startPickup();
  }

  if (!(e.buttons & 1)) {
    dragEnd();
    return;
  }

  window.petAPI.moveWindow(e.screenX - dragOffsetX, e.screenY - dragOffsetY);
});

dragDot.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  if (dragActive) dragEnd();
  dragPending = false;
});
