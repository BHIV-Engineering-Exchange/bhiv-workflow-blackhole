// prana-core/prana_packet_builder.js
// Unified PRANA packet builder (Gurukul + EMS).
// Emits a single truth packet every 5 seconds with unified schema:
// {
//   user_id,
//   session_id,
//   lesson_id: null | string,
//   system_type: "gurukul" | "ems",
//   role: "student" | "employee",
//   timestamp,
//   cognitive_state,
//   active_seconds,
//   idle_seconds,
//   away_seconds,
//   focus_score (0–100, deterministic),
//   raw_signals
// }

import { CognitiveState, initStateEngine, getStateEngine } from './prana_state_engine.js';
import { initSignalCapture, getSignalCapture } from './signals.js';
import { initBucketBridge, sendPranaPacket } from './bucket_bridge.js';

class PranaPacketBuilder {
  /**
   * @param {Object} signalCapture - unified SignalCapture instance
   * @param {Object} stateEngine - unified StateEngine instance
   * @param {Object} baseContext - static context { system_type, role, user_id, session_id, lesson_id?, bucket_endpoint? }
   */
  constructor(signalCapture, stateEngine, baseContext) {
    if (!signalCapture) {
      throw new Error('[PRANA] Packet Builder requires SignalCapture instance');
    }
    if (!stateEngine) {
      throw new Error('[PRANA] Packet Builder requires StateEngine instance');
    }

    // Honor global kill switch
    if (typeof window !== 'undefined' && window.PRANA_DISABLED === true) {
      console.log('[PRANA] Packet Builder disabled via kill switch');
      return;
    }

    this.signalCapture = signalCapture;
    this.stateEngine = stateEngine;

    this.baseContext = {
      system_type: baseContext?.system_type ?? null,
      role: baseContext?.role ?? null,
      user_id: baseContext?.user_id ?? null,
      session_id: baseContext?.session_id ?? null,
      lesson_id: baseContext?.lesson_id ?? null,
    };

    this.contextProvider = null;

    // Window tracking
    this.windowDuration = 5000; // 5 seconds
    this.windowStart = performance.now();

    // Time accounting
    this.timeAccounting = {
      active_ms: 0,
      idle_ms: 0,
      away_ms: 0,
    };

    this.lastState = null;
    this.lastCheckTime = performance.now();
    this._emitInterval = null;

    this._init();
  }

  _init() {
    console.log('[PRANA] Packet Builder initialized');
    this._startTimeAccounting();
    this._emitInterval = setInterval(() => {
      this._emitPacket();
    }, this.windowDuration);
  }

  _startTimeAccounting() {
    setInterval(() => {
      const now = performance.now();
      const elapsed = now - this.lastCheckTime;
      const currentState = this.stateEngine.getCurrentState();
      const signals = this.signalCapture.getSignals();

      if (currentState === CognitiveState.AWAY || signals.tab_visible === false) {
        this.timeAccounting.away_ms += elapsed;
      } else if (currentState === CognitiveState.IDLE) {
        this.timeAccounting.idle_ms += elapsed;
      } else {
        this.timeAccounting.active_ms += elapsed;
      }

      this.lastCheckTime = now;
      this.lastState = currentState;
    }, 100);
  }

  _emitPacket() {
    const cognitiveState = this.stateEngine.getCurrentState();
    const signals = this.signalCapture.getSignals();
    const context = this._getContext();
    const timeInSeconds = this._normalizeTimeAccounting();
    const focusScore = this._calculateFocusScore(signals, cognitiveState, timeInSeconds);

    const packet = {
      user_id: context.user_id,
      session_id: context.session_id,
      lesson_id: context.lesson_id ?? null,
      system_type: context.system_type,
      role: context.role,
      timestamp: new Date().toISOString(),
      cognitive_state: cognitiveState,
      active_seconds: timeInSeconds.active,
      idle_seconds: timeInSeconds.idle,
      away_seconds: timeInSeconds.away,
      focus_score: focusScore,
      raw_signals: {
        ...signals,
      },
    };

    console.log('[PRANA_PACKET]', packet);

    // Send via unified Bucket Bridge
    try {
      sendPranaPacket(packet);
    } catch (e) {
      console.warn('[PRANA] Failed to enqueue packet to Bucket Bridge:', e);
    }

    this._resetWindow();
    return packet;
  }

  _getContext() {
    let dynamic = {};
    if (this.contextProvider && typeof this.contextProvider.getContext === 'function') {
      try {
        dynamic = this.contextProvider.getContext() || {};
      } catch (e) {
        console.warn('[PRANA] Error from context provider:', e);
      }
    }

    return {
      system_type: this.baseContext.system_type,
      role: this.baseContext.role,
      user_id: dynamic.user_id ?? this.baseContext.user_id ?? null,
      session_id: dynamic.session_id ?? this.baseContext.session_id ?? null,
      lesson_id: dynamic.lesson_id ?? this.baseContext.lesson_id ?? null,
    };
  }

  _normalizeTimeAccounting() {
    // Convert ms to seconds with exact integer math to avoid rounding drift
    // Total window is exactly 5000ms, so we use integer division and assign remainder deterministically
    const totalMs = this.timeAccounting.active_ms + this.timeAccounting.idle_ms + this.timeAccounting.away_ms;
    
    // If total doesn't equal 5000ms (due to timing precision), normalize proportionally
    let activeMs = this.timeAccounting.active_ms;
    let idleMs = this.timeAccounting.idle_ms;
    let awayMs = this.timeAccounting.away_ms;
    
    if (totalMs !== 5000 && totalMs > 0) {
      // Scale proportionally to exactly 5000ms
      const scale = 5000 / totalMs;
      activeMs = activeMs * scale;
      idleMs = idleMs * scale;
      awayMs = awayMs * scale;
    } else if (totalMs === 0) {
      // Edge case: no time recorded, assign all to active (default)
      activeMs = 5000;
      idleMs = 0;
      awayMs = 0;
    }
    
    // Convert to seconds with 1 decimal precision, ensuring exact 5.0 total
    let active = Math.round(activeMs / 100) / 10;
    let idle = Math.round(idleMs / 100) / 10;
    let away = Math.round(awayMs / 100) / 10;
    
    // Enforce exact 5.0: assign any rounding remainder to the largest category deterministically
    let total = active + idle + away;
    if (total !== 5.0) {
      const diff = 5.0 - total;
      // Deterministic assignment: largest value gets remainder
      if (active >= idle && active >= away) {
        active = Math.round((active + diff) * 10) / 10;
      } else if (idle >= away) {
        idle = Math.round((idle + diff) * 10) / 10;
      } else {
        away = Math.round((away + diff) * 10) / 10;
      }
    }
    
    // Final verification: ensure exactly 5.0 (no tolerance)
    total = active + idle + away;
    if (total !== 5.0) {
      // Last resort: assign remainder to active (deterministic fallback)
      active = Math.round((active + (5.0 - total)) * 10) / 10;
    }

    return { active, idle, away };
  }

  _calculateFocusScore(signals, cognitiveState, timeInSeconds) {
    // Deterministic focus score (0–100), no randomness, no role/system branching.
    if (signals.tab_visible === false || cognitiveState === CognitiveState.AWAY) {
      return 0;
    }

    let baseScore = 0;
    switch (cognitiveState) {
      case CognitiveState.DEEP_FOCUS:
        baseScore = 95;
        break;
      case CognitiveState.ON_TASK:
        baseScore = 75;
        break;
      case CognitiveState.THINKING:
        baseScore = 65;
        break;
      case CognitiveState.DISTRACTED:
        baseScore = 30;
        break;
      case CognitiveState.IDLE:
        baseScore = 10;
        break;
      case CognitiveState.OFF_TASK:
        baseScore = 5;
        break;
      default:
        baseScore = 50;
    }

    let adjustedScore = baseScore;

    if ((signals.mouse_velocity ?? 0) > 2000) {
      adjustedScore -= 10;
    }

    if ((signals.rapid_click_count ?? 0) >= 3) {
      adjustedScore -= 15;
    }

    if ((signals.dwell_time_ms ?? 0) < 30000) {
      adjustedScore -= 10;
    }

    if (signals.panel_focused === false) {
      adjustedScore -= 20;
    }

    // Time-based scaling: reduce score proportionally if less than full 5s was active
    // This accounts for partial-window engagement (e.g., ON_TASK for 2s, AWAY for 3s)
    // State selection already considers time via signals, but this scales the final score
    // based on actual active time in the 5-second window
    const activeRatio = timeInSeconds.active / 5.0;
    adjustedScore = Math.round(adjustedScore * activeRatio);

    return Math.max(0, Math.min(100, adjustedScore));
  }

  _resetWindow() {
    this.timeAccounting = {
      active_ms: 0,
      idle_ms: 0,
      away_ms: 0,
    };
    this.windowStart = performance.now();
    this.lastCheckTime = performance.now();
  }

  registerContextProvider(provider) {
    if (provider && typeof provider.getContext === 'function') {
      this.contextProvider = provider;
      console.log('[PRANA] Context provider registered');
    }
  }

  destroy() {
    if (this._emitInterval) {
      clearInterval(this._emitInterval);
      console.log('[PRANA] Packet Builder stopped');
    }
  }
}

// Singleton
let packetBuilderInstance = null;

export function initPacketBuilder(signalCapture, stateEngine, baseContext = null) {
  if (!packetBuilderInstance) {
    packetBuilderInstance = new PranaPacketBuilder(signalCapture, stateEngine, baseContext);
  }
  return packetBuilderInstance;
}

export function getPacketBuilder() {
  return packetBuilderInstance;
}

/**
 * High-level init used by thin wrappers:
 * PRANA.init({ system_type, role, user_id, session_id, lesson_id?, bucket_endpoint? })
 */
export function initPranaCore(config) {
  const signalCapture = getSignalCapture() || initSignalCapture();
  const stateEngine = getStateEngine() || initStateEngine(signalCapture);
  initBucketBridge({ endpoint: config?.bucket_endpoint });

  const builder = initPacketBuilder(signalCapture, stateEngine, {
    system_type: config?.system_type,
    role: config?.role,
    user_id: config?.user_id ?? null,
    session_id: config?.session_id ?? null,
    lesson_id: config?.lesson_id ?? null,
  });

  return {
    signalCapture,
    stateEngine,
    packetBuilder: builder,
  };
}

// Attach global namespace for thin wrappers
if (typeof window !== 'undefined') {
  window.PRANA = window.PRANA || {};
  if (typeof window.PRANA.init !== 'function') {
    window.PRANA.init = initPranaCore;
  }
  window.PRANA.CognitiveState = CognitiveState;
}

export default PranaPacketBuilder;


