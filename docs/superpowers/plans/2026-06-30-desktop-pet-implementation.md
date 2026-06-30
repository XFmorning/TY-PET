# Desktop Pet 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Windows 11 上构建一个 Electron 桌面宠物，支持透明 WebM 视频叠加、状态切换、系统托盘和管理后台。

**Architecture:** Electron 主进程管理窗口/状态机/托盘/配置，两个渲染进程分别渲染宠物窗口（透明置顶）和管理后台。通过 IPC 通信。

**Tech Stack:** Electron 28+, Node.js 24, electron-builder, 原生 HTML/CSS/JS (无前端框架)

## Global Constraints

- 项目根目录: `D:\OneDrive\桌面\claude --dangerously-skip-permissions\AI TY Pet\`
- WebM 视频文件必须放在 `animations/` 子目录
- 所有代码无需 TypeScript，纯 JS
- IPC 通信必须通过 preload 脚本 + contextBridge 暴露安全 API
- 窗口必须透明 (`transparent: true`) + 置顶 (`alwaysOnTop: true`)
- 配置持久化到 `%APPDATA%/desktop-pet/config.json`

---

### Task 1: 项目脚手架

**文件:**
- Create: `package.json`
- Create: `.gitignore`
- Modify: 移动 webm 文件到 `animations/`

- [ ] **Step 1: 创建目录结构**

```bash
cd "D:/OneDrive/桌面/claude --dangerously-skip-permissions/AI TY Pet"
mkdir -p main renderer/pet renderer/settings assets animations
```

- [ ] **Step 2: 将现有 webm 文件移动到 animations/**

```bash
mv "待机.webm" "animations/"
mv "打招呼.webm" "animations/"
mv "调皮.webm" "animations/"
mv "蹲下.webm" "animations/"
```

- [ ] **Step 3: 创建 .gitignore**

```bash
cat > .gitignore << 'EOF'
node_modules/
dist/
.DS_Store
*.log
EOF
```

- [ ] **Step 4: 创建 package.json**

```bash
cat > package.json << 'PACKAGEEOF'
{
  "name": "desktop-pet",
  "version": "1.0.0",
  "description": "桌面宠物 - 透明 WebM 桌面叠加应用",
  "main": "main/index.js",
  "scripts": {
    "start": "electron .",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.desktop.pet",
    "productName": "桌面宠物",
    "files": [
      "main/**/*",
      "renderer/**/*",
      "assets/**/*",
      "animations/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.png"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.png"
    }
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0"
  }
}
PACKAGEEOF
```

- [ ] **Step 5: 安装依赖**

```bash
cd "D:/OneDrive/桌面/claude --dangerously-skip-permissions/AI TY Pet"
npm install
```

预期: `node_modules/` 目录创建成功，无报错。

---

### Task 2: 核心模块 — 动画注册、配置持久化、状态机

**文件:**
- Create: `main/animations.js`
- Create: `main/settings.js`
- Create: `main/state-machine.js`

**Interfaces:**
- Produces: 
  - `animations.list` → `{id, state, src, loop}[]`
  - `settings.get(key)` / `settings.set(key, value)` / `settings.getAll()`
  - `StateMachine` class: `transition(state)`, `getState()`, `onStateChange(cb)`, `onReset(cb)`, `getClickState()` (用于判断单次/多次点击)

- [ ] **Step 1: 创建 animations.js**

```js
const path = require('path');

const ANIMATIONS = {
  idle:    { id: 'idle',    state: 'idle',    src: 'animations/待机.webm',   loop: true },
  greet:   { id: 'greet',   state: 'greet',   src: 'animations/打招呼.webm', loop: false },
  playful: { id: 'playful', state: 'playful', src: 'animations/调皮.webm',  loop: false },
  squat:   { id: 'squat',   state: 'squat',   src: 'animations/蹲下.webm',   loop: false },
};

function resolveAnimationPath(anim) {
  return path.join(__dirname, '..', anim.src);
}

function getAll() {
  return Object.values(ANIMATIONS).map(a => ({
    ...a,
    resolvedSrc: resolveAnimationPath(a)
  }));
}

function getByState(state) {
  const entry = Object.values(ANIMATIONS).find(a => a.state === state);
  return entry ? { ...entry, resolvedSrc: resolveAnimationPath(entry) } : null;
}

function getById(id) {
  const entry = ANIMATIONS[id];
  return entry ? { ...entry, resolvedSrc: resolveAnimationPath(entry) } : null;
}

module.exports = { getAll, getByState, getById };
```

验证: `node -e "require('./main/animations').getAll().forEach(a => console.log(a.id, a.loop))"`

- [ ] **Step 2: 创建 settings.js**

```js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

const DEFAULTS = {
  alwaysOnTop: true,
  randomEnabled: true,
  randomInterval: 120,
  autoStart: false,
  animations: {
    idle: 'animations/待机.webm',
    greet: 'animations/打招呼.webm',
    playful: 'animations/调皮.webm',
    squat: 'animations/蹲下.webm'
  }
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      cache = { ...DEFAULTS, ...data };
    } else {
      cache = { ...DEFAULTS };
    }
    return cache;
  } catch {
    cache = { ...DEFAULTS };
    return cache;
  }
}

function save() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

function get(key) {
  load();
  return cache[key];
}

function set(key, value) {
  load();
  cache[key] = value;
  save();
  return value;
}

function getAll() {
  return load();
}

function reset() {
  cache = { ...DEFAULTS };
  save();
}

module.exports = { get, set, getAll, reset };
```

- [ ] **Step 3: 创建 state-machine.js**

```js
const { getByState } = require('./animations');

const STATES = { IDLE: 'idle', GREET: 'greet', PLAYFUL: 'playful', SQUAT: 'squat' };

class StateMachine {
  constructor() {
    this.currentState = STATES.IDLE;
    this.stateChangeListeners = [];
    this.resetListeners = [];
    this.clickTimestamps = [];
  }

  getState() { return this.currentState; }

  transition(state) {
    if (state === this.currentState) {
      // 相同状态→重新播放
      this.resetListeners.forEach(cb => cb());
      return;
    }
    this.currentState = state;
    this.stateChangeListeners.forEach(cb => cb(state));
  }

  transitionToIdle() {
    this.currentState = STATES.IDLE;
    this.stateChangeListeners.forEach(cb => cb(STATES.IDLE));
  }

  onStateChange(cb) { this.stateChangeListeners.push(cb); }
  onReset(cb) { this.resetListeners.push(cb); }

  // 点击检测: 返回 'single' | 'multi' | null
  // 1秒内3次点击 = multi, 否则 single
  handleClick() {
    const now = Date.now();
    this.clickTimestamps = this.clickTimestamps.filter(t => now - t < 1000);
    this.clickTimestamps.push(now);

    if (this.clickTimestamps.length >= 3) {
      this.clickTimestamps = [];
      return 'multi';
    }
    return 'single';
  }
}

module.exports = { StateMachine, STATES };
```

---

### Task 3: IPC Preload 脚本

**文件:**
- Create: `main/preload-pet.js`
- Create: `main/preload-settings.js`

**Interfaces:**
- Produces: `window.petAPI` (pet window), `window.settingsAPI` (settings window)

- [ ] **Step 1: 创建 preload-pet.js**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  onPlay: (callback) => {
    ipcRenderer.on('pet:play', (_event, anim) => callback(anim));
  },
  onClick: () => {
    ipcRenderer.send('pet:click');
  },
  onStateChange: (callback) => {
    ipcRenderer.on('pet:state-change', (_event, state) => callback(state));
  },
  onReset: (callback) => {
    ipcRenderer.on('pet:reset', () => callback());
  }
});
```

- [ ] **Step 2: 创建 preload-settings.js**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  getAll: () => ipcRenderer.invoke('settings:getAll'),
  set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  onStateChange: (callback) => {
    ipcRenderer.on('pet:state-change', (_event, state) => callback(state));
  },
  preview: (animId) => {
    ipcRenderer.send('pet:preview', animId);
  }
});
```

---

### Task 4: 宠物窗口 (透明视频渲染)

**文件:**
- Create: `renderer/pet/index.html`
- Create: `renderer/pet/pet.css`
- Create: `renderer/pet/pet.js`

**Interfaces:**
- Consumes: `window.petAPI` (preload暴露的IPC API)
- Produces: 透明窗口，播放动画，捕获点击

- [ ] **Step 1: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; media-src 'self' file:;">
  <link rel="stylesheet" href="pet.css">
</head>
<body>
  <div id="container">
    <video id="video" autoplay muted playsinline></video>
  </div>
  <script src="pet.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 pet.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  -webkit-app-region: no-drag;
}
#container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
video {
  display: block;
  max-width: 100%;
  max-height: 100%;
  /* 透明WebM关键：背景透明 */
  background: transparent;
  cursor: pointer;
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 3: 创建 pet.js**

```js
const video = document.getElementById('video');

let currentAnim = null;
let idleLoop = true; // idle 结束后自动重播

// 监听主进程的播放指令
window.petAPI.onPlay((anim) => {
  currentAnim = anim;
  idleLoop = (anim.state === 'idle');
  video.src = anim.resolvedSrc;
  video.loop = !!anim.loop;
  video.play().catch(() => {});
});

// 视频播放完毕 → 通知主进程回到 idle
video.addEventListener('ended', () => {
  if (!idleLoop) {
    // 非待机动作用完，通知主进程
    window.petAPI.onClick(); // 复用 click 通道：触发主进程回到 idle
  } else {
    video.currentTime = 0;
    video.play().catch(() => {});
  }
});

// 接收状态切换通知（播放中再次触发时重置）
window.petAPI.onReset(() => {
  video.currentTime = 0;
  video.play().catch(() => {});
});

// 点击事件 - 发送到主进程判断单次/多次
video.addEventListener('click', () => {
  window.petAPI.onClick();
});
```

---

### Task 5: 系统托盘

**文件:**
- Create: `main/tray.js`

**Interfaces:**
- Produces: `createTray(window, settingsWindow)` → 创建托盘图标和菜单
- Consumes: `settings` module, main window reference

- [ ] **Step 1: 创建 tray.js**

```js
const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

function createTray(mainWindow, settingsWindow) {
  // 创建 32x32 托盘图标 (用 nativeImage 生成带颜色的图标)
  const iconSize = 32;
  const canvas = Buffer.alloc(iconSize * iconSize * 4);
  for (let i = 0; i < iconSize * iconSize; i++) {
    const offset = i * 4;
    // 简单爪子图标：填充一个 paw-like 形状
    const x = i % iconSize;
    const y = Math.floor(i / iconSize);
    const cx = iconSize / 2, cy = iconSize / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    // 中心圆 + 四个小圆
    const isCenter = dist < 8;
    const isPad1 = Math.sqrt((x - cx + 8) ** 2 + (y - cy + 8) ** 2) < 5;
    const isPad2 = Math.sqrt((x - cx - 8) ** 2 + (y - cy + 8) ** 2) < 5;
    const isPad3 = Math.sqrt((x - cx + 6) ** 2 + (y - cy - 7) ** 2) < 4;
    const isPad4 = Math.sqrt((x - cx - 6) ** 2 + (y - cy - 7) ** 2) < 4;
    if (isCenter || isPad1 || isPad2 || isPad3 || isPad4) {
      canvas[offset] = 0x66;     // R
      canvas[offset + 1] = 0x99; // G
      canvas[offset + 2] = 0xFF; // B
      canvas[offset + 3] = 0xFF; // A
    }
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize });

  const tray = new Tray(icon);
  tray.setToolTip('桌面宠物');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏宠物',
      click: () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
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
      click: () => {
        mainWindow.destroy();
        if (settingsWindow) settingsWindow.destroy();
        require('electron').app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  return tray;
}

module.exports = { createTray };
```

---

### Task 6: 管理后台 (Settings Window)

**文件:**
- Create: `renderer/settings/index.html`
- Create: `renderer/settings/style.css`
- Create: `renderer/settings/app.js`

**Interfaces:**
- Consumes: `window.settingsAPI` (preload暴露的IPC API)
- Produces: 管理界面 UI

- [ ] **Step 1: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline';">
  <link rel="stylesheet" href="style.css">
  <title>桌面宠物 - 管理</title>
</head>
<body>
  <div class="container">
    <header>
      <h1>🐾 桌面宠物管理</h1>
      <span id="currentState" class="state-badge">待机中</span>
    </header>

    <section class="card">
      <h2>状态信息</h2>
      <div class="info-grid">
        <div class="info-item">
          <label>当前动画</label>
          <span id="stateDisplay">待机</span>
        </div>
        <div class="info-item">
          <label>随机动作</label>
          <span id="randomStatus">已启用</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>动画列表</h2>
      <div class="anim-list" id="animList">
        <div class="anim-item" data-id="idle">
          <span class="anim-name">待机</span>
          <span class="anim-badge loop">循环</span>
        </div>
        <div class="anim-item" data-id="greet">
          <span class="anim-name">打招呼</span>
          <span class="anim-badge">单次</span>
        </div>
        <div class="anim-item" data-id="playful">
          <span class="anim-name">调皮</span>
          <span class="anim-badge">单次</span>
        </div>
        <div class="anim-item" data-id="squat">
          <span class="anim-name">蹲下</span>
          <span class="anim-badge">单次</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>设置</h2>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="chkAlwaysOnTop" checked>
          窗口置顶
        </label>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="chkRandom" checked>
          启用随机动作
        </label>
      </div>
      <div class="setting-row">
        <label>
          随机间隔 (秒):
          <input type="number" id="randomInterval" value="120" min="30" max="600" class="input-num">
        </label>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="chkAutoStart">
          开机自启
        </label>
      </div>
    </section>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f5f5f7;
  color: #333;
  padding: 20px;
}
.container { max-width: 500px; margin: 0 auto; }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
h1 { font-size: 20px; font-weight: 600; }
.state-badge {
  background: #4CAF50;
  color: #fff;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.card h2 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #666;
}
.info-grid { display: flex; gap: 24px; }
.info-item label { display: block; font-size: 12px; color: #999; }
.info-item span { font-size: 16px; font-weight: 500; }
.anim-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.anim-item:last-child { border-bottom: none; }
.anim-item:hover { background: #f9f9f9; }
.anim-name { font-size: 14px; }
.anim-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  background: #e8e8e8;
  color: #666;
}
.anim-badge.loop { background: #e3f2fd; color: #1976d2; }
.setting-row { margin-bottom: 12px; }
.setting-row:last-child { margin-bottom: 0; }
.setting-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}
.input-num {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}
input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
```

- [ ] **Step 3: 创建 app.js**

```js
document.addEventListener('DOMContentLoaded', async () => {
  // 加载设置
  const settings = await window.settingsAPI.getAll();

  // 填充当前值
  document.getElementById('chkAlwaysOnTop').checked = settings.alwaysOnTop;
  document.getElementById('chkRandom').checked = settings.randomEnabled;
  document.getElementById('randomInterval').value = settings.randomInterval;
  document.getElementById('chkAutoStart').checked = settings.autoStart;

  // 监听状态变更
  window.settingsAPI.onStateChange((state) => {
    const stateMap = {
      idle: '待机中',
      greet: '打招呼',
      playful: '调皮',
      squat: '蹲下'
    };
    document.getElementById('currentState').textContent = stateMap[state] || state;
    document.getElementById('stateDisplay').textContent = stateMap[state] || state;
  });

  // 设置变更 → 保存
  document.getElementById('chkAlwaysOnTop').addEventListener('change', (e) => {
    window.settingsAPI.set('alwaysOnTop', e.target.checked);
  });
  document.getElementById('chkRandom').addEventListener('change', (e) => {
    window.settingsAPI.set('randomEnabled', e.target.checked);
    document.getElementById('randomStatus').textContent = e.target.checked ? '已启用' : '已禁用';
  });
  document.getElementById('randomInterval').addEventListener('change', (e) => {
    window.settingsAPI.set('randomInterval', parseInt(e.target.value, 10));
  });
  document.getElementById('chkAutoStart').addEventListener('change', (e) => {
    window.settingsAPI.set('autoStart', e.target.checked);
  });

  // 点击动画项触发播放 (通过主进程)
  document.querySelectorAll('.anim-item').forEach(item => {
    item.addEventListener('click', () => {
      const animId = item.dataset.id;
      window.settingsAPI.preview(animId);
    });
  });
});
```

---

### Task 7: 主入口 — 整合所有模块

**文件:**
- Create: `main/index.js`

- [ ] **Step 1: 创建 main/index.js**

```js
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { StateMachine, STATES } = require('./state-machine');
const { createTray } = require('./tray');
const { getByState, getById } = require('./animations');
const settings = require('./settings');

let mainWindow = null;
let settingsWindow = null;
let tray = null;
const stateMachine = new StateMachine();
let randomTimer = null;

function createPetWindow() {
  mainWindow = new BrowserWindow({
    width: 200,
    height: 200,
    transparent: true,
    frame: false,
    alwaysOnTop: settings.get('alwaysOnTop'),
    resizable: false,
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
  mainWindow.setIgnoreMouseEvents(false);

  // 点击穿透 - 让视频区域可点击
  mainWindow.on('focus', () => {});
  
  return mainWindow;
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 540,
    height: 620,
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
    e.preventDefault();
    settingsWindow.hide();
  });

  return settingsWindow;
}

function playAnimation(animationState) {
  if (!mainWindow) return;
  const anim = getByState(animationState);
  if (!anim) return;
  mainWindow.webContents.send('pet:play', anim);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('pet:state-change', animationState);
  }
}

// 调度随机动作
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
  }, interval + Math.random() * 10000); // 加随机偏移
}

// IPC: 点击处理
// handleClick 始终记录时间戳（滑动1s窗口）
// 达到3次 → multi（调皮）；单次且在IDLE → greet；单次且在非IDLE → 重播当前动画
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
    // 非 idle 时单次点击 → 重播当前动画
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
  
  // 实时应用部分设置
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

// IPC: 预览动画（从管理后台触发）
ipcMain.on('pet:preview', (_e, animId) => {
  const { getById } = require('./animations');
  const anim = getById(animId);
  if (anim && mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    stateMachine.transition(anim.state);
    playAnimation(anim.state);
    // 预览后自动回到 idle（在 animation-ended 中处理）
  }
});

// 监听视频播放完毕 (pet.js里click通道触发)
// 修正: pet.js 里用 onClick 发 click，但我们需要区分"点击"和"播完"
// 方案: 不在 pet.js 里用 onClick 做播完通知，改为监听 video ended 后用不同通道
// 但为了简化，pet.js 的 ended 回调改为发送专用消息

app.whenReady().then(() => {
  createPetWindow();
  createSettingsWindow();
  tray = createTray(mainWindow, settingsWindow);

  // 启动初始动画
  playAnimation(STATES.IDLE);
  scheduleRandomAction();

  // 监听状态机状态变更
  stateMachine.onStateChange((state) => {
    if (state === STATES.IDLE) {
      // 通知 settings window
    }
  });

  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  clearTimeout(randomTimer);
  app.quit();
});
```

---

### Task 8: 修正与完善

基于 Task 7 的实现，需要修正两个问题：

**问题1:** `pet.js` 中视频播完应该用专用 IPC 通道，而非复用 `onClick`
**问题2:** `main/index.js` 需要对应新通道

- [ ] **Step 1: 更新 pet.js 中视频播放完毕逻辑**

```js
// 替换 pet.js 中 video.ended 监听
video.addEventListener('ended', () => {
  if (currentAnim && currentAnim.state !== 'idle') {
    // 非待机动作用完，通知主进程回到 idle
    window.petAPI.animationEnded();
  } else if (currentAnim && currentAnim.state === 'idle') {
    video.currentTime = 0;
    video.play().catch(() => {});
  }
});
```

- [ ] **Step 2: 更新 preload-pet.js 添加 animationEnded 通道**

```js
// 在 preload-pet.js 的 petAPI 中添加:
animationEnded: () => {
  ipcRenderer.send('pet:animation-ended');
},
```

- [ ] **Step 3: 确保 main/index.js 已包含 animation-ended IPC 处理器**

已在 Task 7 中包含，确认即可。

---

### Task 9: 运行与验证

- [ ] **Step 1: 启动应用**

```bash
cd "D:/OneDrive/桌面/claude --dangerously-skip-permissions/AI TY Pet"
npm start
```

预期: Electron 窗口启动，显示透明视频（待机循环），托盘图标出现，可点击宠物触发动画。

- [ ] **Step 2: 验证功能清单**
- [ ] 宠物窗口透明置顶，视频待机循环播放
- [ ] 点击一次宠物 → 播放打招呼 → 回到待机
- [ ] 1秒内快速点击3次 → 播放调皮 → 回到待机
- [ ] 等待2分钟 → 自动播放蹲下 → 回到待机
- [ ] 托盘图标显示，右键菜单可用
- [ ] 管理后台可打开，设置可读写
- [ ] 随机动作开关生效
- [ ] 窗口置顶开关即时生效
- [ ] 退出功能正常
