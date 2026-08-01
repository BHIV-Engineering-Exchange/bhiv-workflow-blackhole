/**
 * EMS Signal Collector - Browser-Side Implementation
 * This script captures real-time user activity signals and sends them to the server
 * 
 * Include this script in your web application to enable employee monitoring
 * Usage: <script src="/ems-signal-collector.js"></script>
 */

class EMSSignalCollector {
  constructor(config = {}) {
    this.config = {
      employeeId: config.employeeId || null,
      sessionId: config.sessionId || this.generateSessionId(),
      apiEndpoint: config.apiEndpoint || '/api/ems-signals',
      batchInterval: config.batchInterval || 10000, // Send batch every 10 seconds
      throttleInterval: config.throttleInterval || 100, // Throttle events to max 10/second
      debug: config.debug || true,
      ...config
    };

    this.signalBuffer = [];
    this.lastEvents = {
      keystroke: 0,
      mouse: 0,
      scroll: 0,
      focus: 0
    };

    this.currentState = {
      isActive: false,
      currentUrl: window.location.href,
      currentTitle: document.title,
      tabId: this.generateTabId()
    };

    this.init();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTabId() {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  init() {
    if (!this.config.employeeId) {
      console.warn('[EMS] No employeeId provided. Signal collection disabled.');
      return;
    }

    this.log('🚀 Initializing EMS Signal Collector');
    this.initializeTracking();
    this.setupEventListeners();
    this.startBatchProcessor();
    this.log('✅ EMS Signal Collector ready');
  }

  async initializeTracking() {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/signals/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: this.config.employeeId,
          sessionId: this.config.sessionId
        })
      });
      
      if (response.ok) {
        this.log('✅ Signal tracking initialized on server');
      }
    } catch (error) {
      console.error('[EMS] Failed to initialize tracking:', error);
    }
  }

  setupEventListeners() {
    // SIGNAL 1: Window Focus
    window.addEventListener('focus', () => this.handleWindowFocus(true));
    window.addEventListener('blur', () => this.handleWindowFocus(false));

    // SIGNAL 2: Keystroke Rate
    document.addEventListener('keydown', (e) => this.handleKeystroke(e));

    // SIGNAL 3: Mouse Movement
    document.addEventListener('mousemove', (e) => this.handleMouseMovement(e));
    document.addEventListener('click', (e) => this.handleMouseMovement(e, 'click'));

    // SIGNAL 4: Scroll Depth
    window.addEventListener('scroll', () => this.handleScroll());

    // SIGNAL 5: Task Tab Active (URL changes)
    this.observeUrlChanges();

    // SIGNAL 8: Browser Hidden
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

    // Page unload - send remaining signals
    window.addEventListener('beforeunload', () => this.flushSignals());

    this.log('📡 Event listeners registered');
  }

  // SIGNAL 1: Window Focus Detection
  handleWindowFocus(isFocused) {
    const now = Date.now();
    if (now - this.lastEvents.focus < this.config.throttleInterval) return;
    this.lastEvents.focus = now;

    this.addSignal({
      type: 'window_focus',
      value: isFocused,
      metadata: {
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus()
      }
    });

    this.log(`🔍 Window Focus: ${isFocused ? 'FOCUSED' : 'BLURRED'}`);
  }

  // SIGNAL 2: Keystroke Detection
  handleKeystroke(event) {
    const now = Date.now();
    if (now - this.lastEvents.keystroke < this.config.throttleInterval) return;
    this.lastEvents.keystroke = now;

    // Don't capture actual key values for privacy
    this.addSignal({
      type: 'keystroke',
      metadata: {
        key: event.key.length === 1 ? 'char' : event.key, // Only log special keys
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      }
    });

    this.log(`⌨️  Keystroke detected`);
  }

  // SIGNAL 3: Mouse Movement
  handleMouseMovement(event, type = 'move') {
    const now = Date.now();
    if (now - this.lastEvents.mouse < this.config.throttleInterval) return;
    this.lastEvents.mouse = now;

    this.addSignal({
      type: 'mouse_movement',
      metadata: {
        x: event.clientX,
        y: event.clientY,
        type: type,
        screenX: event.screenX,
        screenY: event.screenY
      }
    });

    if (type === 'click') {
      this.log(`🖱️  Mouse click at (${event.clientX}, ${event.clientY})`);
    }
  }

  // SIGNAL 4: Scroll Depth
  handleScroll() {
    const now = Date.now();
    if (now - this.lastEvents.scroll < this.config.throttleInterval) return;
    this.lastEvents.scroll = now;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const scrollPercentage = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100) || 0;

    this.addSignal({
      type: 'scroll_depth',
      metadata: {
        percentage: scrollPercentage,
        scrollTop: scrollTop,
        documentHeight: scrollHeight,
        viewportHeight: clientHeight,
        direction: this.lastScrollTop > scrollTop ? 'up' : 'down'
      }
    });

    this.lastScrollTop = scrollTop;
    this.log(`📜 Scroll: ${scrollPercentage}%`);
  }

  // SIGNAL 5: Task Tab Active
  observeUrlChanges() {
    // Initial capture
    this.captureTaskTabActive();

    // Detect URL changes (for SPAs)
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.currentState.currentUrl = currentUrl;
        this.currentState.currentTitle = document.title;
        this.captureTaskTabActive();
      }
    });

    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    // Also listen for hash changes and popstate
    window.addEventListener('hashchange', () => this.captureTaskTabActive());
    window.addEventListener('popstate', () => this.captureTaskTabActive());
  }

  captureTaskTabActive() {
    const url = window.location.href;
    const title = document.title;
    const domain = window.location.hostname;

    this.addSignal({
      type: 'task_tab_active',
      metadata: {
        url: url,
        title: title,
        domain: domain,
        tabId: this.currentState.tabId,
        isActive: document.hasFocus()
      }
    });

    this.log(`📑 Tab Active: ${domain} - ${title}`);
  }

  // SIGNAL 8: Browser Hidden
  handleVisibilityChange() {
    const isHidden = document.hidden;

    this.addSignal({
      type: 'browser_hidden',
      value: isHidden,
      metadata: {
        visibilityState: document.visibilityState,
        documentHidden: document.hidden,
        reason: isHidden ? 'tab_hidden' : 'tab_visible'
      }
    });

    this.log(`👁️  Browser ${isHidden ? 'HIDDEN' : 'VISIBLE'}`);
  }

  // Add signal to buffer
  addSignal(signal) {
    this.signalBuffer.push({
      ...signal,
      timestamp: Date.now()
    });

    // Auto-flush if buffer gets too large
    if (this.signalBuffer.length >= 50) {
      this.flushSignals();
    }
  }

  // Start batch processor
  startBatchProcessor() {
    setInterval(() => {
      if (this.signalBuffer.length > 0) {
        this.flushSignals();
      }
    }, this.config.batchInterval);

    this.log('⚙️  Batch processor started');
  }

  // Send buffered signals to server
  async flushSignals() {
    if (this.signalBuffer.length === 0) return;

    const signals = [...this.signalBuffer];
    this.signalBuffer = [];

    // Get auth token for authenticated requests
    const token = localStorage.getItem('WorkflowToken');

    try {
      const response = await fetch(`${this.config.apiEndpoint}/signals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-auth-token': token } : {})
        },
        body: JSON.stringify({
          employeeId: this.config.employeeId,
          sessionId: this.config.sessionId,
          signals: signals
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.log(`📤 Sent ${signals.length} signals. Activity Score: ${data.statistics?.activityScore || 0}`);
        
        // Log current state from server
        if (data.currentState) {
          this.logCurrentState(data.currentState, data.statistics);
        }
      } else {
        console.error('[EMS] Failed to send signals:', response.statusText);
        // Re-add signals to buffer to retry
        this.signalBuffer.unshift(...signals);
      }
    } catch (error) {
      console.error('[EMS] Error sending signals:', error);
      // Re-add signals to buffer to retry
      this.signalBuffer.unshift(...signals);
    }
  }

  // Log current state (LIVE CAPTURE PROOF)
  logCurrentState(state, statistics) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 LIVE CAPTURE PROOF - Employee Activity State');
    console.log('='.repeat(80));
    console.log('Employee ID:', this.config.employeeId);
    console.log('Session ID:', this.config.sessionId);
    console.log('Timestamp:', new Date().toLocaleString());
    console.log('\n📈 CURRENT STATE:');
    console.log('  Window Focus:', state.window_focus ? '✅ WORKING' : '❌ BACKGROUND');
    console.log('  Keystroke Rate:', state.keystroke_rate, 'keys/min');
    console.log('  Mouse Movement:', state.mouse_movement, 'moves/min');
    console.log('  Scroll Depth:', state.scroll_depth, '%');
    console.log('  Task Tab Active:', state.task_tab_active ? '✅ REAL TASK' : '❌ NON-TASK');
    console.log('  Idle Time:', Math.floor(state.idle_time / 1000), 'seconds');
    console.log('  App Switches:', state.app_switch_count);
    console.log('  Browser Hidden:', state.browser_hidden ? '❌ PRETENDING' : '✅ VISIBLE');
    
    if (statistics) {
      console.log('\n📊 STATISTICS:');
      console.log('  Activity Score:', statistics.activityScore, '/100');
      console.log('  Productivity:', statistics.productivityIndicator?.toUpperCase());
      console.log('  Risk Level:', statistics.riskLevel?.toUpperCase());
      console.log('  Signals (Last Min):', statistics.signalsLastMinute);
    }
    console.log('='.repeat(80) + '\n');
  }

  // Get live capture proof
  async getLiveCaptureProof() {
    try {
      const token = localStorage.getItem('WorkflowToken');
      const response = await fetch(`${this.config.apiEndpoint}/signals/${this.config.employeeId}/proof`, {
        headers: token ? { 'x-auth-token': token } : {}
      });
      if (response.ok) {
        const proof = await response.json();
        this.logCurrentState(proof.current_state, proof.statistics);
        return proof;
      }
    } catch (error) {
      console.error('[EMS] Failed to get live capture proof:', error);
    }
  }

  // Logging helper
  log(message) {
    if (this.config.debug) {
      console.log(`[EMS] ${message}`);
    }
  }

  // Public method to stop tracking
  stop() {
    this.flushSignals();
    this.log('🛑 Signal collection stopped');
  }
}

// Auto-initialize if employee data is available in localStorage/sessionStorage
if (typeof window !== 'undefined') {
  window.EMSSignalCollector = EMSSignalCollector;

  // Auto-start if configuration is found
  const autoStart = () => {
    let employeeId = null;
    try {
      const stored = localStorage.getItem('WorkflowUser');
      if (stored) employeeId = JSON.parse(stored).id;
    } catch (_) {}
    if (!employeeId) employeeId = localStorage.getItem('employeeId') || sessionStorage.getItem('userId');

    // Resolve correct API base:
    // 1. Use window.__EMS_API_BASE set by auth-context (most reliable)
    // 2. Fallback to localhost:5000 for local dev
    // 3. Fallback to same-origin /api for production
    const apiBase = window.__EMS_API_BASE ||
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'
        : window.location.origin + '/api');

    if (employeeId) {
      window.emsCollector = new EMSSignalCollector({
        employeeId: employeeId,
        apiEndpoint: `${apiBase}/ems-signals`,
        debug: true
      });

      // Make proof available globally
      window.getEMSProof = () => window.emsCollector.getLiveCaptureProof();
      
      console.log('✅ [EMS] Auto-started signal collection for employee:', employeeId);
      console.log('💡 [EMS] Run window.getEMSProof() to see live capture proof');
    }
  };

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoStart);
  } else {
    autoStart();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EMSSignalCollector;
}
