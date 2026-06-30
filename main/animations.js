const path = require('path');

const ANIMATIONS = {
  idle:    { id: 'idle',    state: 'idle',    src: 'animations/待机.webm',    loop: true },
  greet:   { id: 'greet',   state: 'greet',   src: 'animations/打招呼.webm',  loop: false },
  playful: { id: 'playful', state: 'playful', src: 'animations/调皮.webm',   loop: false },
  squat:   { id: 'squat',   state: 'squat',   src: 'animations/蹲下.webm',    loop: false },
  typing:  { id: 'typing',  state: 'typing',  src: 'animations/键盘打字.webm', loop: false },
};

function resolveAnimationPath(anim) {
  return path.join(__dirname, '..', anim.src);
}

function getAll() {
  return Object.values(ANIMATIONS).map(a => ({
    ...a,
    resolvedSrc: resolveAnimationPath(a)
  }));
}

function getByState(state) {
  const entry = Object.values(ANIMATIONS).find(a => a.state === state);
  return entry ? { ...entry, resolvedSrc: resolveAnimationPath(entry) } : null;
}

function getById(id) {
  const entry = ANIMATIONS[id];
  return entry ? { ...entry, resolvedSrc: resolveAnimationPath(entry) } : null;
}

module.exports = { getAll, getByState, getById };
