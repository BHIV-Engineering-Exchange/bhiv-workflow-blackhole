// prana-core/signals.js
// Unified PRANA signal layer used by both Gurukul (PRANA-G) and EMS (PRANA-E).
// Superset of all raw browser/user signals from the existing implementations.

class SignalCapture {
  constructor() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('[PRANA] SignalCapture requires a browser environment');
    }

    // Honor global kill switch
    if (window.PRANA_DISABLED === true) {
      console.log('[PRANA] Signal layer disabled via kill switch');
      this.signals = {};
      return;
    }

    // Superset of signal fields (Gurukul + EMS)
    this.signals = {
      // Timestamps
      timestamp: new Date().toISOString(),

      // Focus / visibility
      window_focus: document.hasFocus(),
      browser_visibility: document.visibilityState || 'visible',
      browser_hidden: document.visibilityState === 'hidden',
      tab_visible: !document.hidden,
      panel_focused: document.hasFocus(),
      task_tab_active: document.hasFocus() && document.visibilityState === 'visible',

      // Activity counts / movement
      keystroke_count: 0,
      mouse_events: 0,
      mouse_distance: 0,
      scroll_events: 0,
      content_clicks: 0,
      app_switches: 0,

      // Higher-level motion / position metrics
      mouse_velocity: 0,
      scroll_depth: 0,
      hover_loops: 0,

      // Time / idle metrics
      idle_seconds: 0,
      inactivity_ms: 0,
      dwell_time_ms: 0,

      // Pattern detectors
      rapid_click_count: 0,
    };

    // Internal tracking (not exposed)
    this._mousePositions = [];
    this._hoverPositions = [];
    this._clickTimestamps = [];
    this._lastActivityTime = performance.now();
    this._pageLoadTime = performance.now();
    this._lastMouseX = null;
    this._lastMouseY = null;

    this._logInterval = null;

    this._init();
  }

  _init() {
    this._attachFocusAndVisibilityListeners();
    this._attachKeyboardListeners();
    this._attachMouseListeners();
    this._attachScrollListeners();
    this._attachClickListeners();
    this._attachInactivityTracker();
    this._startLiveLogging();

    console.log('[PRANA] Unified SignalCapture initialized');
  }

  _markActivity() {
    const now = performance.now();
    this._lastActivityTime = now;
    this.signals.inactivity_ms = 0;
  }

  _attachFocusAndVisibilityListeners() {
    window.addEventListener(
      'focus',
      () => {
        this.signals.window_focus = true;
        this.signals.panel_focused = true;
        this.signals.browser_visibility = document.visibilityState || this.signals.browser_visibility;
        this.signals.browser_hidden = this.signals.browser_visibility === 'hidden';
        this.signals.tab_visible = !document.hidden;
        this.signals.task_tab_active = this.signals.window_focus && this.signals.browser_visibility === 'visible';
        this._markActivity();
      },
      { passive: true }
    );

    window.addEventListener(
      'blur',
      () => {
        // Losing focus is treated as a potential app/tab switch
        this.signals.window_focus = false;
        this.signals.panel_focused = false;
        this.signals.task_tab_active = false;
        this.signals.app_switches += 1;
      },
      { passive: true }
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        this.signals.browser_visibility = document.visibilityState || this.signals.browser_visibility;
        this.signals.browser_hidden = this.signals.browser_visibility === 'hidden';
        this.signals.tab_visible = !document.hidden;
        this.signals.task_tab_active =
          this.signals.window_focus && this.signals.browser_visibility === 'visible';

        if (this.signals.browser_hidden) {
          // Conservative: any hide is treated as an app/tab change
          this.signals.app_switches += 1;
        }
      },
      { passive: true }
    );
  }

  _attachKeyboardListeners() {
    window.addEventListener(
      'keydown',
      () => {
        // Rate only, never key content
        this.signals.keystroke_count += 1;
        this._markActivity();
      },
      { passive: true }
    );
  }

  _attachMouseListeners() {
    document.addEventListener(
      'mousemove',
      (e) => {
        const now = performance.now();
        const pos = { x: e.clientX, y: e.clientY, time: now };

        this.signals.mouse_events += 1;

        // Approximate mouse distance (EMS style)
        if (this._lastMouseX !== null && this._lastMouseY !== null) {
          const dx = e.clientX - this._lastMouseX;
          const dy = e.clientY - this._lastMouseY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (Number.isFinite(distance)) {
            this.signals.mouse_distance += distance;
          }
        }
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;

        // Instant velocity (Gurukul style)
        if (this._mousePositions.length > 0) {
          const last = this._mousePositions[this._mousePositions.length - 1];
          const dx = pos.x - last.x;
          const dy = pos.y - last.y;
          const dt = now - last.time;
          if (dt > 0) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            this.signals.mouse_velocity = Math.round((distance / dt) * 1000); // px/s
          }
        }

        // Track recent positions for hover loop detection
        this._hoverPositions.push(pos);
        if (this._hoverPositions.length > 20) {
          this._hoverPositions.shift();
        }
        this._detectHoverLoops();

        // Keep last N positions for velocity calculation
        this._mousePositions.push(pos);
        if (this._mousePositions.length > 10) {
          this._mousePositions.shift();
        }

        this._markActivity();
      },
      { passive: true }
    );
  }

  _detectHoverLoops() {
    if (this._hoverPositions.length < 10) return;

    const recent = this._hoverPositions.slice(-10);
    const xs = recent.map((p) => p.x);
    const ys = recent.map((p) => p.y);

    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);

    // If confined to small area (50px box) for 10 movements = hover loop
    if (xRange < 50 && yRange < 50) {
      this.signals.hover_loops += 1;
    }
  }

  _attachScrollListeners() {
    // Window-level scroll
    window.addEventListener(
      'scroll',
      () => {
        this.signals.scroll_events += 1;

        // Compute scroll depth (Gurukul style)
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const maxScroll = documentHeight - windowHeight;
        if (maxScroll > 0) {
          this.signals.scroll_depth = Math.round((scrollTop / maxScroll) * 100);
        } else {
          this.signals.scroll_depth = 100;
        }

        this._markActivity();
      },
      { passive: true }
    );

    // Inner containers scroll detection (no UI structure inspection)
    document.addEventListener(
      'scroll',
      (event) => {
        // Count all scroll events uniformly (no DOM structure checks)
        this.signals.scroll_events += 1;
        this._markActivity();
      },
      { passive: true, capture: true }
    );
  }

  _attachClickListeners() {
    document.addEventListener(
      'click',
      (event) => {
        const now = performance.now();

        // Rapid click detector (Gurukul style)
        this._clickTimestamps.push(now);
        this._clickTimestamps = this._clickTimestamps.filter((t) => now - t < 2000);
        if (this._clickTimestamps.length >= 3) {
          this.signals.rapid_click_count = this._clickTimestamps.length;
        } else {
          this.signals.rapid_click_count = 0;
        }

        // Count all clicks uniformly (no UI structure inspection)
        this.signals.content_clicks += 1;

        this._markActivity();
      },
      { passive: true, capture: true }
    );
  }

  _attachInactivityTracker() {
    setInterval(() => {
      const now = performance.now();
      const nowWall = Date.now();

      // Idle time: seconds since last human input
      const idleMs = now - this._lastActivityTime;
      this.signals.inactivity_ms = Math.round(idleMs);
      this.signals.idle_seconds = Math.floor(idleMs / 1000);

      // Dwell time: time on page while visible and focused
      if (this.signals.tab_visible && this.signals.panel_focused) {
        this.signals.dwell_time_ms = Math.round(now - this._pageLoadTime);
      }

      // Keep timestamp fresh
      this.signals.timestamp = new Date(nowWall).toISOString();
    }, 1000);
  }

  _startLiveLogging() {
    this._logInterval = setInterval(() => {
      console.log('[PRANA SIGNALS]', {
        timestamp: this.signals.timestamp,
        window_focus: this.signals.window_focus,
        browser_visibility: this.signals.browser_visibility,
        task_tab_active: this.signals.task_tab_active,
        tab_visible: this.signals.tab_visible,
        panel_focused: this.signals.panel_focused,
        idle_seconds: this.signals.idle_seconds,
        inactivity_ms: this.signals.inactivity_ms,
        keystroke_count: this.signals.keystroke_count,
        mouse_events: this.signals.mouse_events,
        mouse_distance: Math.round(this.signals.mouse_distance),
        mouse_velocity: this.signals.mouse_velocity,
        scroll_events: this.signals.scroll_events,
        scroll_depth: this.signals.scroll_depth,
        content_clicks: this.signals.content_clicks,
        rapid_click_count: this.signals.rapid_click_count,
        hover_loops: this.signals.hover_loops,
        app_switches: this.signals.app_switches,
      });
    }, 5000);
  }

  getSignals() {
    return {
      ...this.signals,
    };
  }

  destroy() {
    if (this._logInterval) {
      clearInterval(this._logInterval);
    }
  }
}

// Singleton instance
let signalCaptureInstance = null;

export function initSignalCapture() {
  if (signalCaptureInstance) {
    return signalCaptureInstance;
  }

  signalCaptureInstance = new SignalCapture();
  console.log('[PRANA] Unified SignalCapture layer initialized');
  return signalCaptureInstance;
}

export function getSignalCapture() {
  return signalCaptureInstance;
}

// Auto-start if loaded in browser (side-effect usage for EMS)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    initSignalCapture();
  } catch (e) {
    console.error('[PRANA] Failed to initialize SignalCapture:', e);
  }
}


