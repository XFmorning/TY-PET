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
  },
  ai: {
    enabled: false,
    currentPreset: 0,
    presets: [
      {
        name: '默认',
        url: 'https://api.anthropic.com/v1/messages',
        apiKey: '',
        model: '',
        systemPrompt: '你是天依，一只可爱的桌面宠物精灵。你的性格活泼调皮，说话风格简洁俏皮。回复限制在30字以内，多用语气词和颜文字。不要使用Markdown格式。'
      }
    ]
  }
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      cache = { ...DEFAULTS, ...data };
      if (data.speechTexts) {
        cache.speechTexts = { ...DEFAULTS.speechTexts, ...data.speechTexts };
      }
      if (data.ai) {
        // 兼容旧格式：没有 presets 时自动迁移
        if (!data.ai.presets && data.ai.url) {
          cache.ai = {
            enabled: !!data.ai.enabled,
            currentPreset: 0,
            presets: [{
              name: '默认',
              url: data.ai.url || DEFAULTS.ai.presets[0].url,
              apiKey: data.ai.apiKey || '',
              model: data.ai.model || '',
              systemPrompt: data.ai.systemPrompt || DEFAULTS.ai.presets[0].systemPrompt
            }]
          };
        } else {
          cache.ai = { ...DEFAULTS.ai, ...data.ai };
          // 确保 presets 深层合并
          if (data.ai.presets && data.ai.presets.length > 0) {
            cache.ai.presets = data.ai.presets.map((p, i) => ({
              ...DEFAULTS.ai.presets[0],
              ...p
            }));
          }
        }
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

// 获取当前激活的预设配置（合并 enabled 等顶层字段）
function getActiveAi() {
  const ai = get('ai') || {};
  const preset = ai.presets?.[ai.currentPreset ?? 0];
  if (!preset) return { enabled: false, url: '', apiKey: '', model: '', systemPrompt: '' };
  return {
    enabled: !!ai.enabled,
    url: preset.url || '',
    apiKey: preset.apiKey || '',
    model: preset.model || '',
    systemPrompt: preset.systemPrompt || ''
  };
}

module.exports = { get, set, getAll, reset, getActiveAi };
