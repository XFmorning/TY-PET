const input = document.getElementById('input');
const sizer = document.getElementById('sizer');

function updateWidth() {
  sizer.textContent = input.value || input.placeholder;
  // 文字宽度 + 输入框padding(12) + 两个按钮(44) + 间距(6) + wrap间距+边框(12)
  const w = Math.max(80, Math.min(500, sizer.offsetWidth + 74));
  window.chatAPI.resize(w);
}

input.addEventListener('input', updateWidth);

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
      window.chatAPI.send(text);
      input.value = '';
      updateWidth();
    }
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    window.chatAPI.close();
  }
});

document.getElementById('sendBtn').addEventListener('click', () => {
  const text = input.value.trim();
  if (text) {
    window.chatAPI.send(text);
    input.value = '';
    updateWidth();
  }
});

document.getElementById('closeBtn').addEventListener('click', () => {
  window.chatAPI.close();
});

window.chatAPI.onFocus(() => {
  input.focus();
});

updateWidth();
