/**
 * Activity Tracker - REAL Implementation with uiohook-napi
 * 
 * Tracks actual employee activity using uiohook-napi for precise event capture:
 * - Keyboard presses
 * - Mouse clicks and movements
 * - System idle time via powerMonitor
 * 
 * This provides more accurate metrics than the previous implementation.
 */

const { EventEmitter } = require('events');
const { powerMonitor } = require('electron');
const { uIOhook } = require('uiohook-napi');
const activeAppWatcher = require('../utils/activeAppWatcher');

class ActivityTracker {
  constructor(apiService) {
    this.apiService = apiService;
    this.eventEmitter = new EventEmitter();
    this.isTracking = false;
    this.attendanceId = null;
    
    this.stats = {
      mouseEvents: 0,
      keyboardEvents: 0,
      idleSeconds: 0,
      activeApp: 'System',
      lastActivity: Date.now()
    };

    // Cumulative totals for the active workday session (shown in UI)
    this.sessionTotals = {
      mouseEvents: 0,
      keyboardEvents: 0
    };
    
    this.sendInterval = null;
    
    this.offlineBuffer = [];
    this.MAX_BUFFER_SIZE = 50;
    
    console.log('✅ ActivityTracker initialized (uiohook-napi)');

    // Bind event handlers to the class instance
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleMouseClick = this.handleMouseClick.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this._lastMouseMove = 0;
  }

  handleKeyDown(event) {
    if (this.isTracking) {
      this.stats.keyboardEvents++;
      this.sessionTotals.keyboardEvents++;
      this.stats.lastActivity = Date.now();
    }
  }

  handleMouseClick(event) {
    if (this.isTracking) {
      this.stats.mouseEvents++;
      this.sessionTotals.mouseEvents++;
      this.stats.lastActivity = Date.now();
    }
  }

  handleMouseMove(event) {
    if (this.isTracking) {
      const now = Date.now();
      // Throttle mousemove events to at most 10 per second to keep CPU low
      if (now - this._lastMouseMove >= 100) {
        this._lastMouseMove = now;
        this.stats.mouseEvents++;
        this.sessionTotals.mouseEvents++;
        this.stats.lastActivity = now;
      }
    }
  }

  handleWheel(event) {
    if (this.isTracking) {
      this.stats.mouseEvents++;
      this.sessionTotals.mouseEvents++;
      this.stats.lastActivity = Date.now();
    }
  }

  /**
   * Start tracking activity - REAL IMPLEMENTATION
   * @param {string} attendanceId - The attendance record ID from backend
   */
  start(attendanceId) {
    if (this.isTracking) {
      console.log('⚠️  Tracking already started');
      return;
    }

    console.log('🟢 Starting REAL activity tracking for attendance:', attendanceId);
    this.attendanceId = attendanceId;
    this.isTracking = true;
    
    this.resetStats();
    this.sessionTotals = { mouseEvents: 0, keyboardEvents: 0 };
    
    // Register uiohook listeners (keyboard, clicks, movement, scrolling)
    uIOhook.on('keydown', this.handleKeyDown);
    uIOhook.on('click', this.handleMouseClick);
    uIOhook.on('mousemove', this.handleMouseMove);
    uIOhook.on('wheel', this.handleWheel);
    uIOhook.start();
    
    // Start active window watcher
    activeAppWatcher.start();
    
    this.startDataTransmission();
    
    console.log('✅ Activity tracking started successfully with uiohook-napi');
  }

  /**
   * Stop tracking activity
   */
  async stop() {
    if (!this.isTracking) {
      return;
    }

    console.log('🔴 Stopping activity tracking...');
    this.isTracking = false;
    
    // Stop active window watcher
    activeAppWatcher.stop();
    
    // Unregister uiohook listeners
    uIOhook.off('keydown', this.handleKeyDown);
    uIOhook.off('click', this.handleMouseClick);
    uIOhook.off('mousemove', this.handleMouseMove);
    uIOhook.off('wheel', this.handleWheel);
    
    // Stop uiohook if it's running
    try {
      uIOhook.stop();
    } catch (e) {
      // Ignore errors if already stopped
    }
    
    // Send final data before stopping
    await this.sendActivityData();
    
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
    
    this.attendanceId = null;
    this.resetStats();
    
    console.log('✅ Activity tracking stopped');
  }

  /**
   * Get REAL idle time using Electron's powerMonitor
   * @returns {number} Idle seconds
   */
  getRealIdleTime() {
    try {
      return powerMonitor.getSystemIdleTime();
    } catch (error) {
      console.error('Error getting idle time:', error.message);
      return 0;
    }
  }

  /**
   * Start sending data to backend every 30 seconds
   */
  startDataTransmission() {
    this.sendActivityData();
    
    this.sendInterval = setInterval(() => {
      this.sendActivityData();
    }, 30000); // 30 seconds
  }

  /**
   * Send activity data to backend with offline buffering
   */
  async sendActivityData() {
    if (!this.attendanceId) {
      return;
    }

    try {
      const idleSeconds = this.getRealIdleTime();
      this.stats.idleSeconds = idleSeconds;
      
      const idleThreshold = 300;
      const isProductive = idleSeconds < idleThreshold;
      const productivePercentage = isProductive ? 100 : Math.max(0, 100 - ((idleSeconds - idleThreshold) / 60));

      const currentApp = activeAppWatcher.getCurrentApp() || 'Desktop';
      this.stats.activeApp = currentApp;

      const payload = {
        attendanceId: this.attendanceId,
        timestamp: new Date().toISOString(),
        mouseEvents: this.stats.mouseEvents,
        keyboardEvents: this.stats.keyboardEvents,
        idleSeconds: idleSeconds,
        activeApp: currentApp,
        productivePercentage: Math.round(productivePercentage),
        trackingMode: 'UIOHOOK_NAPI', // Using uiohook-napi
        intervalDuration: 30
      };

      console.log(`📤 Sending activity [${payload.trackingMode}]:`, {
        mouse: payload.mouseEvents,
        keyboard: payload.keyboardEvents,
        app: payload.activeApp,
        idle: payload.idleSeconds + 's',
        productive: payload.productivePercentage + '%'
      });

      // Send to backend if tracking is active
      if (this.isTracking || this.sendInterval === null) { // Also send if it's the last time
        const response = await this.apiService.ingestActivity(payload);
        
        if (response.success) {
          console.log('✅ Activity data sent successfully');
          this.eventEmitter.emit('activity-recorded', {
            mouseEvents: payload.mouseEvents,
            keyboardEvents: payload.keyboardEvents,
            idleSeconds: payload.idleSeconds,
            productivePercentage: payload.productivePercentage
          });
          
          this.resetStats();
          
          await this.flushOfflineBuffer();
        }
      }

    } catch (error) {
      console.error('❌ Failed to send activity data:', error.message);
      
      if (error.response?.status !== 403) {
        this.bufferActivityData();
      } else {
        console.log('🛑 Day not started on server, stopping tracking');
        this.stop();
      }
      
      this.eventEmitter.emit('activity-error', error);
    }
  }
  
  /**
   * Buffer activity data when offline
   */
  bufferActivityData() {
    const bufferedData = {
      attendanceId: this.attendanceId,
      timestamp: new Date().toISOString(),
      stats: {
        mouseEvents: this.stats.mouseEvents,
        keyboardEvents: this.stats.keyboardEvents,
        idleSeconds: this.stats.idleSeconds,
        activeApp: this.stats.activeApp || 'Unknown',
        productivePercentage: Math.round(100 - (this.stats.idleSeconds / 300 * 100))
      }
    };
    
    if (this.offlineBuffer.length < this.MAX_BUFFER_SIZE) {
      this.offlineBuffer.push(bufferedData);
      console.log(`💾 Buffered activity data (${this.offlineBuffer.length}/${this.MAX_BUFFER_SIZE})`);
    } else {
      console.warn('⚠️  Offline buffer full, oldest data will be lost');
      this.offlineBuffer.shift();
      this.offlineBuffer.push(bufferedData);
    }
    
    this.resetStats();
  }
  
  /**
   * Flush buffered offline data to backend
   */
  async flushOfflineBuffer() {
    if (this.offlineBuffer.length === 0) return;
    
    console.log(`🔄 Flushing ${this.offlineBuffer.length} buffered activity records...`);
    
    const toSend = [...this.offlineBuffer];
    this.offlineBuffer = [];
    
    for (const data of toSend) {
      try {
        await this.apiService.ingestActivity(data);
        console.log('✅ Buffered data sent successfully');
      } catch (error) {
        console.error('❌ Failed to send buffered data:', error.message);
        if (this.offlineBuffer.length < this.MAX_BUFFER_SIZE) {
          this.offlineBuffer.push(data);
        }
      }
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      mouseEvents: 0,
      keyboardEvents: 0,
      idleSeconds: 0,
      activeApp: this.stats.activeApp || 'System',
      lastActivity: Date.now()
    };
  }

  /**
   * Get current statistics (for UI display)
   */
  getCurrentStats() {
    return {
      mouseEvents: (this.sessionTotals && this.sessionTotals.mouseEvents !== undefined) 
        ? this.sessionTotals.mouseEvents 
        : this.stats.mouseEvents,
      keyboardEvents: (this.sessionTotals && this.sessionTotals.keyboardEvents !== undefined) 
        ? this.sessionTotals.keyboardEvents 
        : this.stats.keyboardEvents,
      intervalMouseEvents: this.stats.mouseEvents,
      intervalKeyboardEvents: this.stats.keyboardEvents,
      idleSeconds: this.stats.idleSeconds,
      activeApp: activeAppWatcher.getCurrentApp() || 'Desktop',
      isTracking: this.isTracking
    };
  }
}

module.exports = ActivityTracker;
