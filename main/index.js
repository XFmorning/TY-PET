const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const { StateMachine, STATES } = require('./state-machine');
const { createTray } = require('./tray');
const { getByState, getById } = require('./animations');
const settings = require('./settings');
const keyboardMonitor = require('./keyboard-monitor');

// 内存优化：限制渲染进程数、禁用磁盘缓存、限制 JS 堆
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('disk-cache-size', '0');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=64');

// 关闭硬件加速，修复透明 WebM 渲染黑底问题
app.disableHardwareAcceleration();

let mainWindow = null;
let settingsWindow = null;
let tray = null;
const stateMachine = new StateMachine();
let isQuitting = false;
let randomTimer = null;
let keyboardMonitorTimer = null;
let ctxMenuWindow = null;
let lastGreetTime = 0;
const stateCooldownUntil = {};     // state → 冷却结束时间戳
const videoDurations = {};         // state → 视频时长(秒)
let savedWindowSize = null;        // 拖放前窗口尺寸，结束后恢复

// 工作循环状态
const WORK_KEY_THRESHOLD = 20;     // 累计 20 次按键 → 开始工作
const WORK_IDLE_TIMEOUT = 6000;    // 6 秒无打字 → 工作结束
let workPhase = 'idle';            // idle | work-start | working | work-end
let workIdleTimer = null;
let workSequence = null;  // 右键手动串联播放：'work-start' → 'working' → 'work-end'

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

function getSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) return settingsWindow;

  settingsWindow = new BrowserWindow({
    width: 540,
    height: 620,
    resizable: false,
    title: 'TY AI 管理',
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  settingsWindow.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    if (settingsWindow) {
      settingsWindow.destroy();
      settingsWindow = null;
    }
  });

  return settingsWindow;
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
  // 右键手动串联播放：开始打字 → 打字中(不循环) → 打字结束
  if (workSequence) {
    if (workSequence === 'work-start') {
      workSequence = 'working';
      const anim = getByState(STATES.WORKING);
      if (anim && mainWindow) {
        stateMachine.transition(STATES.WORKING);
        mainWindow.webContents.send('pet:play', {
          ...anim, loop: false, speechText: '', forceSpeech: false
        });
      }
      return;
    }
    if (workSequence === 'working') {
      workSequence = null;
      stateMachine.transition(STATES.WORK_END);
      playAnimation(STATES.WORK_END);
      return;
    }
  }

  // 键盘驱动的工作循环：开始工作 → 工作中 → 工作结束 → idle
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
  // 手动串联播放
  if (animId === 'work-sequence') {
    workSequence = 'work-start';
    const anim = getByState(STATES.WORK_START);
    if (anim && mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      stateMachine.transition(STATES.WORK_START);
      mainWindow.webContents.send('pet:play', {
        ...anim, speechText: '', forceSpeech: false
      });
    }
    return;
  }

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

ipcMain.on('pet:show-settings', () => {
  const win = getSettingsWindow();
  win.show();
  win.focus();
});

ipcMain.on('pet:quit', () => {
  app.quit();
});

// IPC: 拖放窗口（只移位置，不碰尺寸）
ipcMain.on('pet:move-window', (_e, x, y) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setPosition(Math.round(x), Math.round(y));
  }
});

// ===== 右键菜单弹出窗口 =====
function createCtxMenuWindow() {
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
    ctxMenuWindow.destroy();
  }
  ctxMenuWindow = new BrowserWindow({
    width: 130,
    height: 320,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-ctx-menu.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  ctxMenuWindow.loadFile(path.join(__dirname, '..', 'renderer', 'ctx-menu', 'index.html'));
  ctxMenuWindow.on('blur', () => {
    if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) ctxMenuWindow.hide();
  });
  return ctxMenuWindow;
}

ipcMain.on('pet:show-ctx-menu', (_e, screenX, screenY) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [petX, petY] = mainWindow.getPosition();
  const [petW, petH] = mainWindow.getSize();
  const win = createCtxMenuWindow();
  const mw = 130, mh = 280;
  // 默认在 pet 右侧，超出屏幕则放左侧
  const display = screen.getDisplayMatching({ x: petX, y: petY, width: petW, height: petH });
  const { x: screenX0, width: screenW } = display.workArea;
  const rightEdge = petX + petW + 4 + mw;
  const wx = rightEdge > screenX0 + screenW
    ? petX - mw - 4
    : petX + petW + 4;
  const wy = Math.max(4, Math.min(screenY - mh / 2, petY + petH - mh - 4));
  win.setPosition(Math.round(wx), Math.round(wy));
  win.show();
});

ipcMain.on('ctx:trigger', (_e, animId) => {
  // 手动串联播放：开始打字 → 打字中 → 打字结束
  if (animId === 'work-sequence') {
    workSequence = 'work-start';
    const anim = getByState(STATES.WORK_START);
    if (anim && mainWindow) {
      stateMachine.transition(STATES.WORK_START);
      mainWindow.webContents.send('pet:play', {
        ...anim, speechText: '', forceSpeech: false
      });
    }
    if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) ctxMenuWindow.hide();
    return;
  }

  const anim = getById(animId);
  if (anim && mainWindow) {
    stateMachine.transition(anim.state);
    playAnimation(anim.state);
  }
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) ctxMenuWindow.hide();
});

ipcMain.on('ctx:hide', () => {
  if (mainWindow) mainWindow.hide();
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) ctxMenuWindow.hide();
});

ipcMain.on('ctx:settings', () => {
  const win = getSettingsWindow();
  win.show();
  win.focus();
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) ctxMenuWindow.hide();
});

ipcMain.on('ctx:quit', () => { app.quit(); });

ipcMain.on('ctx:close', () => {
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) ctxMenuWindow.hide();
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
        const win = getSettingsWindow();
        win.show();
        win.focus();
      }
    },
    {
      label: '跳舞',
      click: () => {
        stateMachine.transition(STATES.DANCE);
        playAnimation(STATES.DANCE);
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
  tray = createTray(mainWindow, getSettingsWindow);

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
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) ctxMenuWindow.destroy();
});

app.on('window-all-closed', () => {
  clearTimeout(randomTimer);
  app.exit(0);
});
