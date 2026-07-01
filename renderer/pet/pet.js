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

// 拎起来 / 放下去 video（按需加载，脱离 DOM，不会触发窗口重排）
const pickupVideo = document.createElement('video');
pickupVideo.preload = 'none';
pickupVideo.loop = false;
pickupVideo.muted = true;

const putdownVideo = document.createElement('video');
putdownVideo.preload = 'none';
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

let speechTimer = null;
const speechBubble = document.getElementById('speechBubble');
const speechTextEl = document.getElementById('speechText');

function showBubble(text, force) {
  const now = Date.now();
  if (!force && speechTimer && now - (speechBubble._lastShow || 0) < 3000) return;
  speechBubble._lastShow = now;
  clearTimeout(speechTimer);
  speechTextEl.textContent = text;
  speechBubble.classList.add('visible');
  speechTimer = setTimeout(() => {
    speechBubble.classList.remove('visible');
  }, 3000);
}

// ===== 播放动画 =====
window.petAPI.onPlay((anim) => {
  if (pickupActive) return;
  pickupActive = false;
  useDragVideo = false;
  currentAnim = anim;
  // 释放上一个视频的解码内存
  video.removeAttribute('src');
  video.load();
  video.src = anim.resolvedSrc;
  video.loop = !!anim.loop;
  video.play().catch(() => {});

  if (anim.speechText) showBubble(anim.speechText, !!anim.forceSpeech);
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
  window.petAPI.showContextMenu(e.screenX, e.screenY);
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
  if (!pickupVideo.src) pickupVideo.src = '拎起来.webm';
  pickupVideo.currentTime = 0;
  pickupVideo.play().catch(() => {});
}

function startPutdown() {
  pickupActive = false;
  useDragVideo = true;
  dragVideo = putdownVideo;
  if (!putdownVideo.src) putdownVideo.src = '放下去.webm';
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

// ===== 自定义右键菜单 =====
const MENU_ITEMS = [
  { section: '动作', items: [
    { icon: '💤', label: '待机', id: 'idle' },
    { icon: '👋', label: '打招呼', id: 'greet' },
    { icon: '🎉', label: '调皮', id: 'playful' },
    { icon: '🪑', label: '蹲下', id: 'squat' },
    { icon: '🔵', label: '画圈圈', id: 'circle' },
    { icon: '💃', label: '跳舞', id: 'dance' },
    { icon: '⌨️', label: '打字工作', id: 'work-sequence' },
  ]},
  { section: '消息', items: [
    { icon: '💬', label: '消息来了', id: 'message' },
  ]},
];

function buildContextMenu() {
  const menu = document.getElementById('ctxMenu');
  menu.innerHTML = '';
  MENU_ITEMS.forEach((section, si) => {
    const div = document.createElement('div');
    div.className = 'menu-section';
    section.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'menu-item';
      el.innerHTML = `<span class="icon">${item.icon}</span><span class="label">${item.label}</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        hideContextMenu();
        window.petAPI.triggerAnimation(item.id);
      });
      div.appendChild(el);
    });
    menu.appendChild(div);
  });

  // 管理区
  const mgmt = document.createElement('div');
  mgmt.className = 'menu-section';

  const hideItem = document.createElement('div');
  hideItem.className = 'menu-item';
  hideItem.innerHTML = '<span class="icon">👁️</span><span class="label">隐藏宠物</span>';
  hideItem.addEventListener('click', (e) => {
    e.stopPropagation();
    hideContextMenu();
    window.petAPI.hideWindow();
  });
  mgmt.appendChild(hideItem);

  const settingsItem = document.createElement('div');
  settingsItem.className = 'menu-item';
  settingsItem.innerHTML = '<span class="icon">⚙️</span><span class="label">打开管理</span>';
  settingsItem.addEventListener('click', (e) => {
    e.stopPropagation();
    hideContextMenu();
    window.petAPI.showSettings();
  });
  mgmt.appendChild(settingsItem);

  const quitItem = document.createElement('div');
  quitItem.className = 'menu-item action-danger';
  quitItem.innerHTML = '<span class="icon">✕</span><span class="label">退出</span>';
  quitItem.addEventListener('click', (e) => {
    e.stopPropagation();
    hideContextMenu();
    window.petAPI.quitApp();
  });
  mgmt.appendChild(quitItem);
  menu.appendChild(mgmt);

  document.addEventListener('click', hideContextMenu, false);
}

let ctxMenuOpen = false;

function showContextMenu(x, y) {
  if (ctxMenuOpen) return;
  ctxMenuOpen = true;
  const menu = document.getElementById('ctxMenu');

  // 先显示菜单以获取实际尺寸
  menu.classList.add('open');
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 如果右侧放不下 → 放在点击位置左边
  let px = x + mw > vw ? Math.max(4, x - mw) : x;
  // 如果底部放不下 → 放在点击位置上方
  let py = y + mh > vh ? Math.max(4, y - mh) : y;
  // 保底：不超出右/下边界
  px = Math.min(px, vw - mw - 4);
  py = Math.min(py, vh - mh - 4);

  menu.style.left = px + 'px';
  menu.style.top = py + 'px';
}

function hideContextMenu() {
  const menu = document.getElementById('ctxMenu');
  menu.classList.remove('open');
  ctxMenuOpen = false;
}

buildContextMenu();
