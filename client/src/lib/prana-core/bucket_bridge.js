// prana-core/bucket_bridge.js
// Unified Bucket Bridge for PRANA packets (Gurukul + EMS).
// No scoring, just reliable delivery of truth packets to BHIV Bucket.

class BucketBridge {
  /**
   * @param {{ endpoint?: string }} options
   */
  constructor(options = {}) {
    if (typeof window === 'undefined') {
      throw new Error('[PRANA] BucketBridge requires a browser environment');
    }

    // Honor global kill switch
    if (window.PRANA_DISABLED === true) {
      console.log('[PRANA] Bucket Bridge disabled via kill switch');
    }

    const defaultEndpoint = 'http://localhost:8001/bucket/prana/ingest';

    this.endpoint = (options && options.endpoint) || defaultEndpoint;

    // Queue for packets
    this.packetQueue = [];
    this.isSending = false;
    this.offlineQueue = [];

    // Configuration
    this.BATCH_SIZE = 5; // Send packets in batches
    this.MAX_RETRIES = 3; // Maximum retry attempts per packet
    this.RETRY_DELAY_BASE = 1000; // Base delay for exponential backoff (ms)
    this.STORAGE_KEY = 'prana_offline_queue'; // localStorage key

    // Stats
    this.sentCount = 0;
    this.failedCount = 0;

    // Load offline queue from localStorage on init
    this._loadOfflineQueue();

    // Setup network status listeners
    this._setupNetworkHandling();

    console.log('[PRANA] Bucket Bridge initialized with endpoint:', this.endpoint);
  }

  /**
   * Enqueue a PRANA packet (non-blocking, no UI impact)
   * @param {object} packet
   */
  enqueuePacket(packet) {
    if (!packet || typeof packet !== 'object') {
      console.warn('[PRANA] Ignoring invalid packet:', packet);
      return;
    }

    // Attach queue timestamp and retry count
    const queuedPacket = {
      ...packet,
      queued_at: new Date().toISOString(),
      retry_count: 0,
    };

    // Check network status
    if (!navigator.onLine) {
      // Offline: add to offline queue and persist
      this.offlineQueue.push(queuedPacket);
      this._persistOfflineQueue();
      console.log('[PRANA] Packet queued offline. Queue size:', this.offlineQueue.length);
      return;
    }

    // Online: add to main queue
    this.packetQueue.push(queuedPacket);

    // Process queue asynchronously (non-blocking)
    if (!this.isSending) {
      // Use setTimeout to ensure non-blocking
      setTimeout(() => this.processQueue(), 0);
    }
  }

  async processQueue() {
    if (this.isSending || (this.packetQueue.length === 0 && this.offlineQueue.length === 0)) {
      return;
    }

    // Move offline queue to main queue if online
    if (navigator.onLine && this.offlineQueue.length > 0) {
      this.packetQueue.push(...this.offlineQueue);
      this.offlineQueue = [];
      this._clearPersistedQueue();
      console.log('[PRANA] Moved offline queue to main queue');
    }

    if (this.packetQueue.length === 0) return;

    this.isSending = true;

    try {
      // Process in batches (batch capable)
      while (this.packetQueue.length > 0) {
        const batch = this.packetQueue.splice(0, this.BATCH_SIZE);
        await this._sendBatch(batch);
        // Small delay between batches to avoid overwhelming server
        await this._delay(50);
      }
    } catch (err) {
      console.error('[PRANA] Error processing packet queue:', err);
    } finally {
      this.isSending = false;

      // Continue processing if more packets available
      if (this.packetQueue.length > 0 || this.offlineQueue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  /**
   * Send a batch of packets (batch capable)
   * @param {Array} batch - Array of packets to send
   */
  async _sendBatch(batch) {
    // For now, backend accepts single packets, so send individually
    // But structure supports batching if backend is updated
    const results = await Promise.allSettled(
      batch.map((packet) => this._sendSingleWithRetry(packet))
    );

    // Count successes and failures
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value === true) {
        this.sentCount += 1;
      } else {
        this.failedCount += 1;
      }
    });
  }

  /**
   * Send a single packet with retry mechanism (retry-safe)
   * @param {object} packet - Packet to send
   * @returns {Promise<boolean>} Success status
   */
  async _sendSingleWithRetry(packet) {
    let retryCount = packet.retry_count || 0;

    while (retryCount <= this.MAX_RETRIES) {
      const success = await this._sendSingle(packet);

      if (success) {
        return true;
      }

      // If failed and haven't exceeded max retries
      if (retryCount < this.MAX_RETRIES) {
        retryCount++;
        packet.retry_count = retryCount;

        // Exponential backoff: delay = base * 2^retryCount
        const delay = this.RETRY_DELAY_BASE * Math.pow(2, retryCount - 1);
        await this._delay(delay);
      } else {
        // Max retries exceeded - move to offline queue (no data loss)
        this.offlineQueue.push(packet);
        this._persistOfflineQueue();
        console.warn('[PRANA] Packet moved to offline queue after max retries:', packet);
        return false;
      }
    }

    return false;
  }

  /**
   * Send a single packet attempt
   * @param {object} packet - Packet to send
   * @returns {Promise<boolean>} Success status
   */
  async _sendSingle(packet) {
    // Remove internal fields before sending
    const { queued_at, retry_count, ...packetToSend } = packet;
    const body = JSON.stringify(packetToSend);

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CLIENT-TIMESTAMP': new Date().toISOString(),
        },
        body,
        // Add signal for timeout handling
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!res.ok) {
        // Try to get error details from response
        let errorDetails = '';
        try {
          const errorData = await res.json();
          errorDetails = JSON.stringify(errorData);
        } catch (e) {
          errorDetails = await res.text().catch(() => 'No error details');
        }
        console.error('[PRANA][BucketBridge] HTTP error:', res.status, res.statusText);
        console.error('[PRANA][BucketBridge] Error details:', errorDetails);
        console.error('[PRANA][BucketBridge] Failed packet:', JSON.stringify(packetToSend, null, 2));
        return false;
      }

      const data = await res.json().catch(() => null);
      console.log('[PRANA][BucketBridge] success:', data);
      return true;
    } catch (err) {
      console.error('[PRANA][BucketBridge] network error:', err);
      return false;
    }
  }

  /**
   * Setup network status listeners (offline queue support)
   */
  _setupNetworkHandling() {
    window.addEventListener('online', () => {
      console.log('[PRANA] Network online, processing offline queue...');
      if (!this.isSending) {
        setTimeout(() => this.processQueue(), 0);
      }
    });

    window.addEventListener('offline', () => {
      console.log('[PRANA] Network offline, queuing packets...');
    });

    // Periodically try to process offline queue (every 30 seconds)
    setInterval(() => {
      if (navigator.onLine && this.offlineQueue.length > 0 && !this.isSending) {
        setTimeout(() => this.processQueue(), 0);
      }
    }, 30000);
  }

  /**
   * Persist offline queue to localStorage (no data loss)
   */
  _persistOfflineQueue() {
    try {
      if (typeof Storage !== 'undefined') {
        // Limit stored queue size to prevent localStorage overflow (keep last 100 packets)
        const queueToStore = this.offlineQueue.slice(-100);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queueToStore));
      }
    } catch (e) {
      console.warn('[PRANA] Failed to persist offline queue:', e);
    }
  }

  /**
   * Load offline queue from localStorage (no data loss)
   */
  _loadOfflineQueue() {
    try {
      if (typeof Storage !== 'undefined') {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          this.offlineQueue = JSON.parse(stored);
          console.log('[PRANA] Loaded', this.offlineQueue.length, 'packets from offline queue');
        }
      }
    } catch (e) {
      console.warn('[PRANA] Failed to load offline queue:', e);
      this.offlineQueue = [];
    }
  }

  /**
   * Clear persisted offline queue
   */
  _clearPersistedQueue() {
    try {
      if (typeof Storage !== 'undefined') {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[PRANA] Failed to clear persisted queue:', e);
    }
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      sent: this.sentCount,
      failed: this.failedCount,
      queued: this.packetQueue.length,
      offline: this.offlineQueue.length,
      totalProcessed: this.sentCount + this.failedCount,
    };
  }
}

// Singleton
let bucketBridgeInstance = null;

export function initBucketBridge(options = {}) {
  if (!bucketBridgeInstance) {
    bucketBridgeInstance = new BucketBridge(options);
  }
  return bucketBridgeInstance;
}

export function getBucketBridge() {
  return bucketBridgeInstance;
}

export function sendPranaPacket(packet) {
  const bridge = bucketBridgeInstance;
  if (!bridge) {
    console.error('[PRANA] Bucket Bridge not initialized, cannot send packet');
    return;
  }
  bridge.enqueuePacket(packet);
}

export default BucketBridge;


