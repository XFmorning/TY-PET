const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { StateMachine, STATES } = require('./state-machine');
const { createTray } = require('./tray');
const { getByState, getById } = require('./animations');
const settings = require('./settings');
const { startKeyboardMonitor, stopKeyboardMonitor } = require('./keyboard-monitor');

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
let lastKeyboardTime = 0;

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
  const speechTexts = settings.get('speechTexts') || {};
  mainWindow.webContents.send('pet:play', {
    ...anim,
    speechText: speechTexts[animationState] || ''
  });
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('pet:state-change', animationState);
  }
}

function scheduleRandomAction() {
  clearTimeout(randomTimer);
  const enabled = settings.get('randomEnabled');
  if (!enabled) return;

  const interval = (settings.get('randomInterval') || 120) * 1000;
  randomTimer = setTimeout(() => {
    if (stateMachine.getState() === STATES.IDLE) {
      stateMachine.transition(STATES.SQUAT);
      playAnimation(STATES.SQUAT);
    }
    scheduleRandomAction();
  }, interval + Math.random() * 10000);
}

// IPC: 点击处理
ipcMain.on('pet:click', () => {
  const clickType = stateMachine.handleClick();
  if (!clickType) return;

  if (clickType === 'multi') {
    stateMachine.transition(STATES.PLAYFUL);
    playAnimation(STATES.PLAYFUL);
  } else if (stateMachine.getState() === STATES.IDLE) {
    stateMachine.transition(STATES.GREET);
    playAnimation(STATES.GREET);
  } else {
    playAnimation(stateMachine.getState());
  }
});

// IPC: 视频播放完毕回到 idle
ipcMain.on('pet:animation-ended', () => {
  stateMachine.transitionToIdle();
  playAnimation(STATES.IDLE);
  scheduleRandomAction();
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

// IPC: 隐藏宠物
ipcMain.on('pet:hide', () => {
  if (mainWindow) mainWindow.hide();
});

// IPC: 显示对话气泡（独立窗口，3秒防抖）
let lastSpeechTime = 0;
ipcMain.on('pet:show-speech', (_e, text) => {
  const now = Date.now();
  if (now - lastSpeechTime < 3000) return;
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

  // 全局键盘监听
  startKeyboardMonitor(() => {
    const now = Date.now();
    if (now - lastKeyboardTime < 11000) return;
    if (stateMachine.getState() !== STATES.IDLE) return;
    lastKeyboardTime = now;
    stateMachine.transition(STATES.TYPING);
    playAnimation(STATES.TYPING);
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
  stopKeyboardMonitor();
});

app.on('window-all-closed', () => {
  clearTimeout(randomTimer);
  clearTimeout(speechHideTimer);
  if (speechWindow && !speechWindow.isDestroyed()) speechWindow.destroy();
  app.exit(0);
});
