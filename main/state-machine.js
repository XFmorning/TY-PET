const STATES = {
  IDLE: 'idle', GREET: 'greet', PLAYFUL: 'playful',
  SQUAT: 'squat', CIRCLE: 'circle',
  WORK_START: 'work-start', WORKING: 'working', WORK_END: 'work-end',
  MESSAGE: 'message', DANCE: 'dance'
};

class StateMachine {
  constructor() {
    this.currentState = STATES.IDLE;
    this.stateChangeListeners = [];
    this.resetListeners = [];
    this.clickTimestamps = [];
  }

  getState() { return this.currentState; }

  transition(state) {
    if (state === this.currentState) {
      this.resetListeners.forEach(cb => cb());
      return;
    }
    this.currentState = state;
    this.stateChangeListeners.forEach(cb => cb(state));
  }

  transitionToIdle() {
    this.currentState = STATES.IDLE;
    this.stateChangeListeners.forEach(cb => cb(STATES.IDLE));
  }

  onStateChange(cb) { this.stateChangeListeners.push(cb); }
  onReset(cb) { this.resetListeners.push(cb); }

  handleClick() {
    const now = Date.now();
    this.clickTimestamps = this.clickTimestamps.filter(t => now - t < 1000);
    this.clickTimestamps.push(now);

    if (this.clickTimestamps.length >= 5) {
      this.clickTimestamps = [];
      return 'multi';
    }
    return 'single';
  }
}

module.exports = { StateMachine, STATES };
