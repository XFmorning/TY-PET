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
  { icon: '⚙️', label: '打开管理', action: 'settings' },
  { icon: '✕', label: '退出', action: 'quit', danger: true },
].forEach(item => {
  const el = document.createElement('div');
  el.className = 'item' + (item.danger ? ' danger' : '');
  el.innerHTML = `<span class="icon">${item.icon}</span>${item.label}`;
  el.addEventListener('click', () => {
    window.menuAPI[item.action]();
  });
  mgmt.appendChild(el);
});
menu.appendChild(mgmt);

// 点击空白关闭
document.addEventListener('click', () => window.menuAPI.close());
