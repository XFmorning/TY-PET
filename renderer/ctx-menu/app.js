const ITEMS = [
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

const menu = document.getElementById('menu');

ITEMS.forEach((section, si) => {
  const div = document.createElement('div');
  div.className = 'section';
  section.items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<span class="icon">${item.icon}</span>${item.label}`;
    el.addEventListener('click', () => {
      window.menuAPI.trigger(item.id);
    });
    div.appendChild(el);
  });
  menu.appendChild(div);
});

// 管理区
const mgmt = document.createElement('div');
mgmt.className = 'section';

[
  { icon: '👁️', label: '隐藏宠物', action: 'hide' },
].forEach(item => {
  const el = document.createElement('div');
  el.className = 'item';
  el.innerHTML = `<span class="icon">${item.icon}</span>${item.label}`;
  el.addEventListener('click', () => window.menuAPI[item.action]());
  mgmt.appendChild(el);
});

// AI 开关
const aiToggle = document.createElement('div');
aiToggle.className = 'item';
aiToggle.id = 'aiToggle';
let aiOn = false;

function updateAiToggle() {
  aiToggle.innerHTML = aiOn
    ? '<span class="icon">✅</span>AI对话: 已开启'
    : '<span class="icon">⬜</span>AI对话: 已关闭';
}
updateAiToggle();

aiToggle.addEventListener('click', () => {
  aiOn = !aiOn;
  updateAiToggle();
  window.menuAPI.toggleAi();
});
mgmt.appendChild(aiToggle);

// 监听主进程推送的 AI 状态
window.menuAPI.onAiState((enabled) => {
  aiOn = enabled;
  updateAiToggle();
});

// 初始化时查询一次
(async () => {
  aiOn = await window.menuAPI.getAiState();
  updateAiToggle();
})();

[
  { icon: '💬', label: '和天依聊天', action: 'chat' },
  { icon: '⚙️', label: '打开管理', action: 'settings' },
  { icon: '✕', label: '退出', action: 'quit', danger: true },
].forEach(item => {
  const el = document.createElement('div');
  el.className = 'item' + (item.danger ? ' danger' : '');
  el.innerHTML = `<span class="icon">${item.icon}</span>${item.label}`;
  el.addEventListener('click', () => window.menuAPI[item.action]());
  mgmt.appendChild(el);
});

menu.appendChild(mgmt);

// 点击空白关闭
document.addEventListener('click', () => window.menuAPI.close());
