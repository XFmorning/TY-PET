const bubble = document.getElementById('bubble');
const textEl = document.getElementById('text');

window.bubbleAPI.onText((text) => {
  textEl.textContent = text;
  requestAnimationFrame(() => {
    window.bubbleAPI.resize(bubble.offsetWidth + 6);
  });
});
