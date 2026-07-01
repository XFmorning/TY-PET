const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

const DEFAULTS = {
  alwaysOnTop: true,
  randomEnabled: true,
  randomInterval: 120,
  autoStart: false,
  windowWidth: 300,
  windowHeight: 300,
  animations: {
    idle: 'animations/待机.webm',
    greet: 'animations/打招呼.webm',
    playful: 'animations/调皮.webm',
    squat: 'animations/蹲下.webm'
  },
  speechTexts: {
    greet: '点击天依干嘛',
    playful: '不要欺负天依嘛',
    squat: '天依站累了'
  }
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      cache = { ...DEFAULTS, ...data };
      // 深层合并 speechTexts，避免保存的部分覆盖全部默认值
      if (data.speechTexts) {
        cache.speechTexts = { ...DEFAULTS.speechTexts, ...data.speechTexts };
      }
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
