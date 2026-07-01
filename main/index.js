const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { StateMachine, STATES } = require('./state-machine');
const { createTray } = require('./tray');
const { getByState, getById } = require('./animations');
const settings = require('./settings');
const keyboardMonitor = require('./keyboard-monitor');

// 关闭硬件加速，修复透明 WebM 渲染黑底问题
app.disableHardwareAcceleration();

let mainWindow = null;
let settingsWindow = null;
let speechWindow = null;
let tray = null;
const stateMachine = new StateMachine();
let isQuitting = false;
let randomTimer = null;
let speechHideTimer = null;
let keyboardMonitorTimer = null;
let lastGreetTime = 0;
const stateCooldownUntil = {};     // state → 冷却结束时间戳
const videoDurations = {};         // state → 视频时长(秒)
let savedWindowSize = null;        // 拖放前窗口尺寸，结束后恢复

// 工作循环状态
const WORK_KEY_THRESHOLD = 20;     // 累计 20 次按键 → 开始工作
const WORK_IDLE_TIMEOUT = 6000;    // 6 秒无打字 → 工作结束
let workPhase = 'idle';            // idle | work-start | working | work-end
let workIdleTimer = null;

function createPetWindow() {
  const savedW = settings.get('windowWidth') || 300;
  const savedH = settings.get('windowHeight') || 300;

  mainWindow = new BrowserWindow({
    width: savedW,
    height: savedH,
    transparent: true,
    frame: false,
    alwaysOnTop: settings.get('alwaysOnTop'),
    resizable: true,
    minWidth: 80,
    minHeight: 80,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-pet.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'pet', 'index.html'));

  // 一开始就锁等比例（视频加载后会更新）
  mainWindow.setAspectRatio(savedW / savedH);

  // 拖边框缩放后保存尺寸
  mainWindow.on('resize', () => {
    const [w, h] = mainWindow.getSize();
    settings.set('windowWidth', w);
    settings.set('windowHeight', h);
  });

  // 页面加载后开始播放
  mainWindow.webContents.on('did-finish-load', () => {
    playAnimation(STATES.IDLE);
  });

  return mainWindow;
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 540,
    height: 620,
    show: false,
    resizable: false,
    title: '桌面宠物管理',
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'));
  settingsWindow.on('close', (e) => {
    if (!settingsWindow || isQuitting) return;
    e.preventDefault();
    settingsWindow.hide();
  });

  return settingsWindow;
}

function createSpeechWindow() {
  speechWindow = new BrowserWindow({
    width: 200,
    height: 36,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  speechWindow.loadFile(path.join(__dirname, '..', 'renderer', 'speech-bubble', 'index.html'));
  speechWindow.on('close', (e) => {
    if (!speechWindow || isQuitting) return;
    e.preventDefault();
    speechWindow.hide();
  });
  return speechWindow;
}

function playAnimation(animationState) {
  if (!mainWindow) return;
  const anim = getByState(animationState);
  if (!anim) return;

  // 工作循环动画不受冷却限制（键盘驱动，需要立即响应）
  const isWorkAnim = animationState === STATES.WORK_START ||
                     animationState === STATES.WORKING ||
                     animationState === STATES.WORK_END;

  if (!isWorkAnim) {
    if (animationState === STATES.PLAYFUL) {
      if (Date.now() < (stateCooldownUntil[STATES.PLAYFUL] || 0)) return;
    } else {
      if (Date.now() < (stateCooldownUntil[animationState] || 0)) return;
    }

    const duration = animationState === STATES.PLAYFUL ? 5 : (videoDurations[animationState] || 2);
    stateCooldownUntil[animationState] = Date.now() + duration * 1000;
  }

  const speechTexts = settings.get('speechTexts') || {};
  mainWindow.webContents.send('pet:play', {
    ...anim,
    speechText: speechTexts[animationState] || '',
    forceSpeech: animationState === STATES.PLAYFUL
  });
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('pet:state-change', animationState);
  }
}

let randomActionToggle = false;

function scheduleRandomAction() {
  clearTimeout(randomTimer);
  if (!settings.get('randomEnabled')) return;

  const interval = (settings.get('randomInterval') || 20) * 1000;

  randomTimer = setTimeout(function tryRandom() {
    if (stateMachine.getState() === STATES.IDLE) {
      randomActionToggle = !randomActionToggle;
      const action = randomActionToggle ? STATES.SQUAT : STATES.CIRCLE;
      stateMachine.transition(action);
      playAnimation(action);
      // animationEnded 会再次调用 scheduleRandomAction
    } else {
      // 非空闲 → 每秒重试，不跟当前动作抢
      randomTimer = setTimeout(tryRandom, 1000);
    }
  }, interval + Math.random() * 10000);
}

// IPC: 点击处理
ipcMain.on('pet:click', () => {
  const clickType = stateMachine.handleClick();
  if (!clickType) return;

  if (clickType === 'multi') {
    stateMachine.transition(STATES.PLAYFUL);
    playAnimation(STATES.PLAYFUL);
    lastGreetTime = Date.now();
  } else if (stateMachine.getState() === STATES.IDLE) {
    if (Date.now() - lastGreetTime < 1500) return;
    lastGreetTime = Date.now();
    stateMachine.transition(STATES.GREET);
    playAnimation(STATES.GREET);
  } else {
    playAnimation(stateMachine.getState());
  }
});

// IPC: 保存拖放前窗口尺寸
ipcMain.on('pet:save-size', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [w, h] = mainWindow.getSize();
    savedWindowSize = { width: w, height: h };
  }
});

// 0.5秒缓动动画恢复窗口尺寸（保留当前位置即拖拽终点）
function animateRestoreSize(targetW, targetH) {
  const steps = 10;
  const stepMs = 15;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t * (2 - t); // ease-out quad
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const [cx, cy] = mainWindow.getPosition();
      const [cw, ch] = mainWindow.getSize();
      const w = Math.round(cw + (targetW - cw) * ease);
      const h = Math.round(ch + (targetH - ch) * ease);
      mainWindow.setBounds({ x: cx, y: cy, width: w, height: h });
    }, i * stepMs);
  }
}

// IPC: 视频播放完毕回到 idle / 或驱动工作循环下一步
ipcMain.on('pet:animation-ended', () => {
  // 工作循环：开始工作 → 工作中 → 工作结束 → idle
  if (workPhase === 'work-start') {
    workPhase = 'working';
    stateMachine.transition(STATES.WORKING);
    playAnimation(STATES.WORKING);
    // 启动空闲超时（工作中首次检测到打字会刷新它）
    clearTimeout(workIdleTimer);
    workIdleTimer = setTimeout(() => {
      if (workPhase === 'working') {
        workPhase = 'work-end';
        stateMachine.transition(STATES.WORK_END);
        playAnimation(STATES.WORK_END);
      }
    }, WORK_IDLE_TIMEOUT);
    return;
  }

  if (workPhase === 'work-end') {
    workPhase = 'idle';
    keyboardMonitor.resetKeystrokes();
    stateMachine.transitionToIdle();
    playAnimation(STATES.IDLE);
    scheduleRandomAction();

    if (savedWindowSize) {
      const { width, height } = savedWindowSize;
      savedWindowSize = null;
      setTimeout(() => animateRestoreSize(width, height), 50);
    }
    return;
  }

  // 普通动画结束
  stateMachine.transitionToIdle();
  playAnimation(STATES.IDLE);
  scheduleRandomAction();

  if (savedWindowSize) {
    const { width, height } = savedWindowSize;
    savedWindowSize = null;
    setTimeout(() => animateRestoreSize(width, height), 50);
  }
});

// IPC: 设置读写
ipcMain.handle('settings:getAll', () => settings.getAll());
ipcMain.handle('settings:set', (_e, key, value) => {
  settings.set(key, value);

  if (key === 'alwaysOnTop' && mainWindow) {
    mainWindow.setAlwaysOnTop(value, 'screen-saver');
  }
  if (key === 'randomEnabled' || key === 'randomInterval') {
    scheduleRandomAction();
  }
  if (key === 'autoStart') {
    app.setLoginItemSettings({ openAtLogin: value });
  }
  return value;
});

// IPC: 预览动画
ipcMain.on('pet:preview', (_e, animId) => {
  const anim = getById(animId);
  if (anim && mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    stateMachine.transition(anim.state);
    playAnimation(anim.state);
  }
});

// IPC: 设置等比例（视频首次加载后发来）
ipcMain.on('pet:set-aspect-ratio', (_e, ratio) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setAspectRatio(ratio);
});

// IPC: 视频时长上报（用于冷却计时）
ipcMain.on('pet:video-duration', (_e, state, duration) => {
  if (duration > 0 && isFinite(duration)) {
    videoDurations[state] = duration;
  }
});

// IPC: 隐藏宠物
ipcMain.on('pet:hide', () => {
  if (mainWindow) mainWindow.hide();
});


// IPC: 显示对话气泡（独立窗口，3秒防抖）
let lastSpeechTime = 0;
ipcMain.on('pet:show-speech', (_e, text, force) => {
  const now = Date.now();
  if (!force && now - lastSpeechTime < 3000) return;
  lastSpeechTime = now;

  if (!speechWindow || speechWindow.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) return;

  const [petX, petY] = mainWindow.getPosition();
  const [petW] = mainWindow.getSize();
  const bubW = 200, bubH = 36;
  speechWindow.setBounds({
    x: petX + Math.round((petW - bubW) / 2),
    y: petY - bubH - 4,
    width: bubW,
    height: bubH
  });
  speechWindow.webContents.send('speech:show', text);
  speechWindow.show();

  clearTimeout(speechHideTimer);
  speechHideTimer = setTimeout(() => {
    if (speechWindow && !speechWindow.isDestroyed()) speechWindow.hide();
  }, 3000);
});

// IPC: 拖放窗口（只移位置，不碰尺寸）
ipcMain.on('pet:move-window', (_e, x, y) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setPosition(Math.round(x), Math.round(y));
  }
});

// IPC: 宠物右键菜单（和托盘风格一致）
ipcMain.on('pet:context-menu', (event, x, y) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const menu = Menu.buildFromTemplate([
    {
      label: '隐藏宠物',
      click: () => { if (mainWindow) mainWindow.hide(); }
    },
    {
      label: '打开管理',
      click: () => {
        if (settingsWindow) {
          settingsWindow.show();
          settingsWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => { app.quit(); }
    }
  ]);
  menu.popup({ window: win });
});

app.whenReady().then(() => {
  createPetWindow();
  createSettingsWindow();
  createSpeechWindow();
  tray = createTray(mainWindow, settingsWindow);

  scheduleRandomAction();

  // 工作循环键盘监听（按键累计 → 开始工作 → 工作中 → 空闲超时 → 工作结束）
  keyboardMonitorTimer = keyboardMonitor.startKeyboardMonitor(() => {
    try {
      const count = keyboardMonitor.getKeystrokes();

      switch (workPhase) {
        case 'idle':
          if (count >= WORK_KEY_THRESHOLD) {
            keyboardMonitor.resetKeystrokes();
            workPhase = 'work-start';
            stateMachine.transition(STATES.WORK_START);
            playAnimation(STATES.WORK_START);
          }
          break;

        case 'working':
          // 持续打字 → 刷新空闲定时器
          clearTimeout(workIdleTimer);
          // 如果被中途打断（如打招呼），立刻切回工作中
          if (stateMachine.getState() !== STATES.WORKING) {
            stateMachine.transition(STATES.WORKING);
            playAnimation(STATES.WORKING);
          }
          workIdleTimer = setTimeout(() => {
            if (workPhase === 'working') {
              workPhase = 'work-end';
              stateMachine.transition(STATES.WORK_END);
              playAnimation(STATES.WORK_END);
            }
          }, WORK_IDLE_TIMEOUT);
          break;
      }
    } catch (e) {
      console.error('keyboard error:', e);
    }
  });

  stateMachine.onStateChange((state) => {
    if (state === STATES.IDLE && settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('pet:state-change', state);
    }
  });

  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  keyboardMonitor.stopKeyboardMonitor(keyboardMonitorTimer);
});

app.on('window-all-closed', () => {
  clearTimeout(randomTimer);
  clearTimeout(speechHideTimer);
  if (speechWindow && !speechWindow.isDestroyed()) speechWindow.destroy();
  app.exit(0);
});
