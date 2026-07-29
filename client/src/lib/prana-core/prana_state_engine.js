// prana-core/prana_state_engine.js
// Unified cognitive/work state engine used by both Gurukul and EMS.
// Allowed states only: ON_TASK, THINKING, IDLE, DISTRACTED, AWAY, OFF_TASK, DEEP_FOCUS.

export const CognitiveState = {
  ON_TASK: 'ON_TASK',
  THINKING: 'THINKING',
  IDLE: 'IDLE',
  DISTRACTED: 'DISTRACTED',
  AWAY: 'AWAY',
  OFF_TASK: 'OFF_TASK',
  DEEP_FOCUS: 'DEEP_FOCUS',
};

class PranaCognitiveStateEngine {
  constructor(signalCapture) {
    if (!signalCapture) {
      throw new Error('[PRANA] State Engine requires SignalCapture instance');
    }

    this.signalCapture = signalCapture;

    // Current state tracking
    this.currentState = CognitiveState.ON_TASK;
    this.stateEntryTime = performance.now();
    this.lastStateChangeTime = performance.now();

    // State history
    this.transitionLog = [];

    // Cooldown configuration (milliseconds)
    this.cooldowns = {
      minimum: 5000, // 5 seconds minimum before any state change
      deepFocusEntry: 15000, // 15 seconds sustained condition for DEEP_FOCUS
    };

    // Deep focus tracking
    this._deepFocusCandidate = false;
    this._deepFocusCandidateTime = null;

    this._evaluationInterval = null;

    this._init();
  }

  _init() {
    console.log('[PRANA] Cognitive State Engine initialized');
    console.log(`[PRANA] INITIAL_STATE: ${this.currentState}`);

    // Evaluate state once per second
    this._evaluationInterval = setInterval(() => {
      this._evaluateState();
    }, 1000);
  }

  _evaluateState() {
    const signals = this.signalCapture.getSignals();
    const now = performance.now();
    const timeSinceLastChange = now - this.lastStateChangeTime;

    // Enforce minimum cooldown between state changes
    if (timeSinceLastChange < this.cooldowns.minimum) {
      return;
    }

    const newState = this._determineState(signals, now);

    if (newState !== this.currentState) {
      this._transitionTo(newState, signals);
    }
  }

  _determineState(signals, now) {
    const tabVisible = signals.tab_visible !== false; // default true
    const panelFocused = !!signals.panel_focused;
    const windowFocus = signals.window_focus !== false; // default true
    const browserVisibility = signals.browser_visibility || 'visible';
    const browserHidden = browserVisibility === 'hidden' || !!signals.browser_hidden;

    const inactivityMs = signals.inactivity_ms ?? 0;
    const idleSeconds = signals.idle_seconds ?? Math.floor(inactivityMs / 1000);

    const rapidClicks = signals.rapid_click_count ?? 0;
    const mouseVelocity = signals.mouse_velocity ?? 0;
    const dwellTimeMs = signals.dwell_time_ms ?? 0;

    // ---- Priority 1: AWAY ----
    // Instant priority override: tab hidden OR window unfocused OR browser hidden
    // No idle-time requirement - AWAY overrides all other states immediately
    if (!tabVisible || !windowFocus || browserHidden) {
      this._resetDeepFocusCandidate();
      return CognitiveState.AWAY;
    }

    // ---- Priority 2: DISTRACTED ----
    // Visible but focus lost (e.g., other window on top, or task tab not active).
    if (tabVisible && !panelFocused) {
      this._resetDeepFocusCandidate();
      return CognitiveState.DISTRACTED;
    }

    // ---- Priority 3: IDLE ----
    // Extended inactivity with visible, focused tab.
    if (tabVisible && panelFocused && idleSeconds >= 600) {
      this._resetDeepFocusCandidate();
      return CognitiveState.IDLE;
    }

    // ---- Priority 4: OFF_TASK ----
    // Anxiety / frustration indicators:
    // - Rapid clicking OR very high mouse velocity.
    if (rapidClicks >= 3 || mouseVelocity > 2500) {
      this._resetDeepFocusCandidate();
      return CognitiveState.OFF_TASK;
    }

    // ---- Priority 5: DEEP_FOCUS ----
    // Sustained calm focus:
    // - High dwell time
    // - Low mouse velocity
    // - Low inactivity
    // - No rapid clicks
    if (
      dwellTimeMs > 60000 && // > 60s on page
      mouseVelocity < 300 &&
      inactivityMs < 10000 &&
      rapidClicks === 0 &&
      tabVisible &&
      panelFocused
    ) {
      if (!this._deepFocusCandidate) {
        this._deepFocusCandidate = true;
        this._deepFocusCandidateTime = now;
      } else {
        const candidateDuration = now - this._deepFocusCandidateTime;
        if (candidateDuration >= this.cooldowns.deepFocusEntry) {
          return CognitiveState.DEEP_FOCUS;
        }
      }
    } else {
      this._resetDeepFocusCandidate();
    }

    // ---- Priority 6: THINKING ----
    // Minimal movement, low but non-zero inactivity, no rapid clicks.
    if (
      mouseVelocity < 200 &&
      inactivityMs < 5000 &&
      inactivityMs > 1000 &&
      rapidClicks === 0 &&
      tabVisible &&
      panelFocused
    ) {
      return CognitiveState.THINKING;
    }

    // ---- Default: ON_TASK ----
    return CognitiveState.ON_TASK;
  }

  _resetDeepFocusCandidate() {
    this._deepFocusCandidate = false;
    this._deepFocusCandidateTime = null;
  }

  _transitionTo(newState, signals) {
    const now = performance.now();
    const previousState = this.currentState;
    const stateDuration = now - this.stateEntryTime;

    const reason = this._getTransitionReason(newState, signals);

    const transition = {
      timestamp: new Date().toISOString(),
      from_state: previousState,
      to_state: newState,
      reason,
      previous_duration_ms: Math.round(stateDuration),
      signals_snapshot: {
        mouse_velocity: signals.mouse_velocity,
        scroll_depth: signals.scroll_depth,
        inactivity_ms: signals.inactivity_ms,
        idle_seconds: signals.idle_seconds,
        rapid_click_count: signals.rapid_click_count,
        tab_visible: signals.tab_visible,
        panel_focused: signals.panel_focused,
        window_focus: signals.window_focus,
        browser_visibility: signals.browser_visibility,
        dwell_time_ms: signals.dwell_time_ms,
      },
    };

    this.transitionLog.push(transition);

    console.log(
      `[PRANA] STATE_CHANGE: ${previousState} → ${newState} | reason: ${reason} | duration: ${Math.round(
        stateDuration / 1000
      )}s`
    );

    this.currentState = newState;
    this.stateEntryTime = now;
    this.lastStateChangeTime = now;
  }

  _getTransitionReason(newState, signals) {
    switch (newState) {
      case CognitiveState.AWAY:
        return 'tab not visible / browser hidden / no focus with sustained idle';
      case CognitiveState.DISTRACTED:
        return 'window lost focus while tab remained visible';
      case CognitiveState.IDLE:
        return `extended inactivity (${Math.round((signals.idle_seconds ?? 0))}s idle)`;
      case CognitiveState.OFF_TASK:
        if (signals.rapid_click_count >= 3) {
          return `rapid clicks detected (${signals.rapid_click_count})`;
        }
        return `high mouse velocity (${signals.mouse_velocity} px/s)`;
      case CognitiveState.DEEP_FOCUS:
        return `sustained calm focus (dwell: ${Math.round(
          (signals.dwell_time_ms ?? 0) / 1000
        )}s, low motion)`;
      case CognitiveState.THINKING:
        return 'contemplative pause detected (low motion, short idle, no rapid clicks)';
      case CognitiveState.ON_TASK:
        return 'active engagement';
      default:
        return 'state rule matched';
    }
  }

  // Public API

  getCurrentState() {
    return this.currentState;
  }

  getStateDuration() {
    return Math.round(performance.now() - this.stateEntryTime);
  }

  getTransitionLog() {
    return [...this.transitionLog];
  }

  getStateSummary() {
    return {
      current_state: this.currentState,
      duration_ms: this.getStateDuration(),
      duration_seconds: Math.round(this.getStateDuration() / 1000),
      entry_time: new Date(Date.now() - this.getStateDuration()).toISOString(),
      total_transitions: this.transitionLog.length,
    };
  }

  destroy() {
    if (this._evaluationInterval) {
      clearInterval(this._evaluationInterval);
      console.log('[PRANA] State Engine stopped');
    }
  }
}

// Singleton
let stateEngineInstance = null;

export function initStateEngine(signalCapture) {
  if (!stateEngineInstance) {
    stateEngineInstance = new PranaCognitiveStateEngine(signalCapture);
  }
  return stateEngineInstance;
}

export function getStateEngine() {
  return stateEngineInstance;
}

export default PranaCognitiveStateEngine;


