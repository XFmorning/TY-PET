# 桌面宠物 (Desktop Pet) 设计文档

## 概述

一个基于 Electron 的跨平台桌面宠物应用，使用透明 WebM 视频渲染宠物动画，浮于桌面顶层，带系统托盘和管理后台。

## 技术栈

- **框架**: Electron
- **窗口**: 透明 BrowserWindow, alwaysOnTop
- **视频**: HTML5 `<video>` 播放透明通道 WebM
- **状态管理**: 有限状态机 (FSM)
- **跨平台**: Windows (首发) / macOS (后续)

## 状态机

```
                  ┌──────────┐
      点击一次     │          │  随机触发 (2min)
  ┌──────────────→ │  打招呼  ├──────────────┐
  │               │ (一次)   │              │
  │               └─────┬────┘              │
  │                     │ 播放完毕           │ 播放完毕
  │                     ↓                   ↓
┌───────┐        ┌──────────┐         ┌────────┐
│ 待机   │ ←───── │  调皮    │         │  蹲下  │
│ (循环) │        │ (一次)   │         │ (一次) │
└───┬───┘        └─────┬────┘         └────────┘
    │                   │
    │ 1s内点击3次       │
    └──────────────────→│
```

- **待机(idle)**: 默认状态，视频循环播放
- **打招呼(greet)**: 点击一次触发，播放完毕回到 idle
- **调皮(playful)**: 1秒内点击3次触发，播放完毕回到 idle
- **蹲下(squat)**: 每2分钟随机触发一次，播放完毕回到 idle
- 状态切换时：若当前有动画正在播放，先停止再切到新状态
- 播放中再次触发：重新从该动画开头播放

## 架构

### 进程模型

```
主进程 (main process)
├── 窗口管理: 创建/控制 Pet Window
├── 系统托盘: 托盘图标 + 右键菜单
├── 状态机: 核心状态调度
├── 视频管理: 注册/加载动画资源
└── 设置管理: 持久化配置

渲染进程 (renderer × 2)
├── Pet Window: 透明窗口，播放视频
└── Settings Window: 管理后台

IPC 通信
├── pet:play <animation>   → 播放指定动画
├── pet:state <state>      → 状态变更通知
├── settings:get/set       → 读写配置
└── tray:menu              → 托盘菜单交互
```

### 模块划分

```
electron-pet/
├── package.json
├── main/                    # 主进程
│   ├── index.js             # 入口, 窗口创建
│   ├── tray.js              # 系统托盘
│   ├── state-machine.js     # 状态机
│   ├── settings.js          # 配置持久化
│   └── animations.js        # 动画注册管理
├── renderer/                # 渲染进程
│   ├── pet/                 # 宠物窗口
│   │   ├── index.html
│   │   ├── pet.js           # 视频播放控制
│   │   └── pet.css
│   └── settings/            # 管理后台
│       ├── index.html
│       ├── app.js
│       └── style.css
└── assets/                  # 静态资源
    └── icon.png             # 托盘图标
```

## 视频 (动画) 管理

- 动画以 WebM 格式存放于 `animations/` 目录
- 每个动画需注册到 `animations.js`，指定：
  - `id`: 唯一标识
  - `state`: 归属状态 (idle/greet/playful/squat)
  - `src`: 视频文件路径
  - `loop`: 是否循环
- 未来新增动画：将 webm 放入目录，在配置中注册即可

## 管理系统功能

### 设置窗口
- 当前状态显示
- 动画列表 (预览/切换)
- 随机动作开关 (`randomEnabled`)
- 随机间隔调节 (默认 2min)
- 开机自启开关
- 窗口置顶开关

### 托盘菜单
- 显示/隐藏宠物
- 打开管理
- 重启动画
- 退出

## 持久化配置

```json
{
  "alwaysOnTop": true,
  "randomEnabled": true,
  "randomInterval": 120,
  "autoStart": false,
  "animations": {
    "idle": "animations/待机.webm",
    "greet": "animations/打招呼.webm",
    "playful": "animations/调皮.webm",
    "squat": "animations/蹲下.webm"
  }
}
```

## 开发计划

1. 项目脚手架: package.json, Electron 配置
2. 主进程: 窗口创建, 透明配置, alwaysOnTop
3. 状态机: FSM 核心逻辑, 状态切换
4. 宠物窗口: 视频渲染, IPC 通信
5. 系统托盘: 托盘图标, 右键菜单
6. 动画管理: animations.js, 注册机制
7. 管理后台: 设置窗口, 配置读写
8. 包装打包: electron-builder 配置

## 未来扩展

- macOS 适配
- 更多动画状态
- 拖拽移动宠物
- 多宠物同时运行
- 与系统交互 (如音量、时间)
