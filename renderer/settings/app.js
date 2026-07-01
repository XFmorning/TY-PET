const ANIMS = [
  { id: 'idle', icon: '💤', label: '待机', loop: true },
  { id: 'greet', icon: '👋', label: '打招呼' },
  { id: 'playful', icon: '🎉', label: '调皮' },
  { id: 'squat', icon: '🪑', label: '蹲下' },
  { id: 'circle', icon: '🔵', label: '画圈圈' },
  { id: 'dance', icon: '💃', label: '跳舞' },
  { id: 'message', icon: '💬', label: '消息来了' },
];

const STATE_LABELS = {
  idle: '待机中', greet: '打招呼', playful: '调皮',
  squat: '蹲下', circle: '画圈圈',
  dance: '跳舞', message: '消息来了'
};

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await window.settingsAPI.getAll();

  document.getElementById('chkAlwaysOnTop').checked = settings.alwaysOnTop;
  document.getElementById('chkRandom').checked = settings.randomEnabled;
  document.getElementById('randomInterval').value = settings.randomInterval || 20;
  document.getElementById('chkAutoStart').checked = settings.autoStart;

  // Speech texts
  const speechTexts = settings.speechTexts || {};
  window._speechTexts = { ...speechTexts };
  document.getElementById('speechGreet').value = speechTexts.greet || '';
  document.getElementById('speechPlayful').value = speechTexts.playful || '';
  document.getElementById('speechSquat').value = speechTexts.squat || '';
  // Random status
  document.getElementById('randomStatus').textContent =
    settings.randomEnabled ? '已启用' : '已禁用';

  // Build animation grid
  const grid = document.getElementById('animGrid');
  ANIMS.forEach(a => {
    const el = document.createElement('div');
    el.className = 'anim-item';
    el.dataset.id = a.id;
    el.innerHTML = `
      <span class="icon">${a.icon}</span>
      <span class="name">${a.label}</span>
      ${a.loop ? '<span class="tag loop">循环</span>' : '<span class="tag">单次</span>'}
    `;
    el.addEventListener('click', () => window.settingsAPI.preview(a.id));
    grid.appendChild(el);
  });

  // State change
  window.settingsAPI.onStateChange((state) => {
    const label = STATE_LABELS[state] || state;
    document.getElementById('currentState').textContent = label;
    document.querySelector('.stat-value#statAnimName').textContent = label;
  });

  // Events
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

  ['speechGreet', 'speechPlayful', 'speechSquat'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      const key = id.replace('speech', '').toLowerCase();
      const texts = { ...(window._speechTexts || {}) };
      texts[key] = e.target.value;
      window._speechTexts = texts;
      window.settingsAPI.set('speechTexts', texts);
    });
  });
});
