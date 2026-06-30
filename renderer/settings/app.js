document.addEventListener('DOMContentLoaded', async () => {
  const settings = await window.settingsAPI.getAll();

  document.getElementById('chkAlwaysOnTop').checked = settings.alwaysOnTop;
  document.getElementById('chkRandom').checked = settings.randomEnabled;
  document.getElementById('randomInterval').value = settings.randomInterval;
  document.getElementById('chkAutoStart').checked = settings.autoStart;

  const speechTexts = settings.speechTexts || {};
  window._speechTexts = { ...speechTexts };
  document.getElementById('speechGreet').value = speechTexts.greet || '';
  document.getElementById('speechPlayful').value = speechTexts.playful || '';
  document.getElementById('speechSquat').value = speechTexts.squat || '';
  document.getElementById('speechTyping').value = speechTexts.typing || '';

  window.settingsAPI.onStateChange((state) => {
    const stateMap = {
      idle: '待机中',
      greet: '打招呼',
      playful: '调皮',
      squat: '蹲下',
      typing: '打字'
    };
    document.getElementById('currentState').textContent = stateMap[state] || state;
    document.getElementById('stateDisplay').textContent = stateMap[state] || state;
  });

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

  ['speechGreet', 'speechPlayful', 'speechSquat', 'speechTyping'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      const key = id.replace('speech', '').toLowerCase();
      const texts = { ...(window._speechTexts || {}) };
      texts[key] = e.target.value;
      window._speechTexts = texts;
      window.settingsAPI.set('speechTexts', texts);
    });
  });

  document.querySelectorAll('.anim-item').forEach(item => {
    item.addEventListener('click', () => {
      const animId = item.dataset.id;
      window.settingsAPI.preview(animId);
    });
  });
});
