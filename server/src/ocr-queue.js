/**
 * AttendTrack Bounded OCR Job Queue with Concurrency Control and Backpressure.
 *
 * Prevents memory exhaustion from unbounded concurrent Tesseract OCR worker allocations.
 * Limits simultaneous OCR operations, bounds queue depth, enforces job timeouts, and
 * tracks operational telemetry.
 */

import { createWorker } from 'tesseract.js';

class BoundedOcrQueue {
  constructor({ maxConcurrency = 1, maxQueueDepth = 10, jobTimeoutMs = 35000 } = {}) {
    this.maxConcurrency = Math.max(1, maxConcurrency);
    this.maxQueueDepth = Math.max(1, maxQueueDepth);
    this.jobTimeoutMs = jobTimeoutMs;

    this.activeCount = 0;
    this.queue = [];
    this.workerPromise = null;

    // Telemetry (no sensitive content logged)
    this.metrics = {
      submitted: 0,
      completed: 0,
      failed: 0,
      rejected: 0,
      timeouts: 0,
      totalDurationMs: 0
    };
  }

  /**
   * Lazily initializes and reuses a single Tesseract OCR worker
   */
  async getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = createWorker('eng', 1, {
        errorHandler: () => {}
      }).catch(err => {
        this.workerPromise = null;
        throw err;
      });
    }
    return this.workerPromise;
  }

  /**
   * Enqueues an image buffer for OCR recognition with backpressure.
   * If the queue is at capacity, rejects immediately.
   *
   * @param {Buffer} buffer Image buffer
   * @returns {Promise<{ text: string, confidence: number }>}
   */
  enqueue(buffer) {
    this.metrics.submitted++;

    // Backpressure check: reject if queue is saturated
    if (this.queue.length >= this.maxQueueDepth) {
      this.metrics.rejected++;
      const err = new Error(
        `OCR processing queue is at capacity (${this.queue.length}/${this.maxQueueDepth}). Please wait a moment and try again.`
      );
      err.status = 429;
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ buffer, resolve, reject, queuedAt: Date.now() });
      this._processNext();
    });
  }

  async _processNext() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.activeCount++;
    const { buffer, resolve, reject, queuedAt } = this.queue.shift();
    const startTime = Date.now();

    let timeoutTimer = null;
    try {
      const worker = await this.getWorker();

      const timeoutPromise = new Promise((_, rejectTimeout) => {
        timeoutTimer = setTimeout(() => {
          this.metrics.timeouts++;
          const err = new Error(`OCR processing timed out after ${this.jobTimeoutMs / 1000} seconds.`);
          err.code = 'OCR_TIMEOUT';
          rejectTimeout(err);
        }, this.jobTimeoutMs);
      });

      const recognitionPromise = worker.recognize(buffer);

      const result = await Promise.race([recognitionPromise, timeoutPromise]);
      clearTimeout(timeoutTimer);

      const duration = Date.now() - startTime;
      this.metrics.completed++;
      this.metrics.totalDurationMs += duration;

      resolve({
        text: result?.data?.text || '',
        confidence: Math.round(result?.data?.confidence || 0),
        durationMs: duration
      });
    } catch (err) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      this.metrics.failed++;
      reject(err);
    } finally {
      this.activeCount--;
      // Explicitly trigger next item in queue
      setImmediate(() => this._processNext());
    }
  }

  async terminate() {
    if (this.workerPromise) {
      try {
        const worker = await this.workerPromise;
        await worker.terminate();
      } catch (_) {}
      this.workerPromise = null;
    }
    // Reject any queued jobs if terminating
    while (this.queue.length > 0) {
      const { reject } = this.queue.shift();
      reject(new Error('OCR worker terminated.'));
    }
  }

  getStats() {
    const avgDurationMs = this.metrics.completed > 0
      ? Math.round(this.metrics.totalDurationMs / this.metrics.completed)
      : 0;

    return {
      activeJobs: this.activeCount,
      queueDepth: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      maxQueueDepth: this.maxQueueDepth,
      submitted: this.metrics.submitted,
      completed: this.metrics.completed,
      failed: this.metrics.failed,
      rejected: this.metrics.rejected,
      timeouts: this.metrics.timeouts,
      avgDurationMs
    };
  }
}

export const ocrQueue = new BoundedOcrQueue({
  maxConcurrency: 1, // Single worker concurrency ensures low heap footprint on Node.js
  maxQueueDepth: 10,
  jobTimeoutMs: 30000
});
