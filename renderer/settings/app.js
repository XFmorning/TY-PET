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

  // AI settings
  let aiData = settings.ai || { enabled: false, currentPreset: 0, presets: [] };
  let currentPresetIdx = aiData.currentPreset || 0;
  const presetSelect = document.getElementById('aiPreset');

  function loadPresetFields() {
    const p = aiData.presets?.[currentPresetIdx];
    if (!p) return;
    document.getElementById('aiUrl').value = p.url || '';
    document.getElementById('aiApiKey').value = p.apiKey || '';
    document.getElementById('aiModel').value = p.model || '';
    document.getElementById('aiSystemPrompt').value = p.systemPrompt || '';
    document.getElementById('chkAiEnabled').checked = !!aiData.enabled;
  }

  function rebuildPresetList() {
    presetSelect.innerHTML = '';
    (aiData.presets || []).forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = p.name || `预设 ${i + 1}`;
      presetSelect.appendChild(opt);
    });
    presetSelect.value = currentPresetIdx;
  }

  function saveAi() {
    // 更新当前预设的字段
    const preset = aiData.presets?.[currentPresetIdx];
    if (preset) {
      preset.url = document.getElementById('aiUrl').value;
      preset.apiKey = document.getElementById('aiApiKey').value;
      preset.model = document.getElementById('aiModel').value;
      preset.systemPrompt = document.getElementById('aiSystemPrompt').value;
    }
    aiData.enabled = document.getElementById('chkAiEnabled').checked;
    aiData.currentPreset = currentPresetIdx;
    window.settingsAPI.set('ai', aiData);
  }

  function switchPreset(idx) {
    currentPresetIdx = idx;
    loadPresetFields();
    rebuildPresetList();
  }

  // 初始加载
  if (aiData.presets && aiData.presets.length > 0) {
    currentPresetIdx = Math.min(aiData.currentPreset || 0, aiData.presets.length - 1);
    rebuildPresetList();
    loadPresetFields();
  }

  presetSelect.addEventListener('change', () => {
    switchPreset(parseInt(presetSelect.value));
  });

  // Modal 对话框
  const modal = document.getElementById('presetModal');
  const modalInput = document.getElementById('modalInput');
  const modalTitle = document.getElementById('modalTitle');
  let modalResolve = null;

  function showModal(title, defVal) {
    return new Promise((resolve) => {
      modalTitle.textContent = title;
      modalInput.value = defVal || '';
      modal.style.display = 'flex';
      modalInput.focus();
      modalInput.select();
      modalResolve = resolve;
    });
  }

  modalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { document.getElementById('modalOk').click(); }
    if (e.key === 'Escape') { document.getElementById('modalCancel').click(); }
  });
  document.getElementById('modalOk').addEventListener('click', () => {
    modal.style.display = 'none';
    if (modalResolve) modalResolve(modalInput.value.trim() || null);
  });
  document.getElementById('modalCancel').addEventListener('click', () => {
    modal.style.display = 'none';
    if (modalResolve) modalResolve(null);
  });

  document.getElementById('aiPresetAdd').addEventListener('click', async () => {
    const name = await showModal('新建预设');
    if (!name) return;
    if (!aiData.presets) aiData.presets = [];
    aiData.presets.push({
      name,
      url: '',
      apiKey: '',
      model: '',
      systemPrompt: '你是天依，一只可爱的桌面宠物精灵。你的性格活泼调皮，说话风格简洁俏皮。回复限制在30字以内，多用语气词和颜文字。不要使用Markdown格式。'
    });
    switchPreset(aiData.presets.length - 1);
    saveAi();
  });

  document.getElementById('aiPresetRename').addEventListener('click', async () => {
    const p = aiData.presets?.[currentPresetIdx];
    if (!p) return;
    const name = await showModal('重命名预设', p.name);
    if (name && name !== p.name) {
      p.name = name;
      rebuildPresetList();
      saveAi();
    }
  });

  document.getElementById('aiPresetDel').addEventListener('click', () => {
    if (!aiData.presets || aiData.presets.length <= 1) return;
    if (!confirm(`删除预设「${aiData.presets[currentPresetIdx]?.name}」？`)) return;
    aiData.presets.splice(currentPresetIdx, 1);
    switchPreset(Math.max(0, currentPresetIdx - 1));
    saveAi();
  });

  document.getElementById('chkAiEnabled').addEventListener('change', saveAi);
  document.getElementById('aiUrl').addEventListener('input', debounce(saveAi, 300));
  document.getElementById('aiApiKey').addEventListener('input', debounce(saveAi, 300));
  document.getElementById('aiModel').addEventListener('input', debounce(saveAi, 300));
  document.getElementById('aiSystemPrompt').addEventListener('input', debounce(saveAi, 300));

  document.getElementById('aiKeyToggle').addEventListener('click', () => {
    const input = document.getElementById('aiApiKey');
    const btn = document.getElementById('aiKeyToggle');
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  });

  // 监控外部启停（右键菜单切换）
  window.settingsAPI.onAiStateChanged((enabled) => {
    aiData.enabled = enabled;
    document.getElementById('chkAiEnabled').checked = enabled;
  });

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }
});
