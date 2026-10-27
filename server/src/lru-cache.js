/**
 * AttendTrack In-Memory Bounded LRU Cache with TTL and Single-Flight Fetching.
 *
 * NOTE ON MULTI-INSTANCE ARCHITECTURE:
 * Each Node.js process maintains its own independent LRU cache. It is NOT a
 * distributed or shared source of truth. Authoritative data resides solely in
 * PostgreSQL. Cached values are read-through and invalidated immediately upon
 * any mutating database operations (e.g., bulk import, student updates).
 */

export class BoundedLRUCache {
  /**
   * @param {Object} options
   * @param {string} options.name Name of the cache for logging and telemetry
   * @param {number} options.maxSize Maximum number of entries before LRU eviction occurs
   * @param {number} options.ttlMs Time-to-live in milliseconds for each cached entry
   */
  constructor({ name = 'default', maxSize = 500, ttlMs = 5 * 60 * 1000 } = {}) {
    this.name = name;
    this.maxSize = Math.max(1, maxSize);
    this.ttlMs = ttlMs;
    this.cache = new Map(); // Key -> { value, expiresAt }
    this.inFlight = new Map(); // Key -> Promise for coalesced fills

    // Operational metrics (sanitized, no sensitive student data)
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      invalids: 0
    };
  }

  /**
   * Retrieves an item from the cache.
   * If expired, it is deleted and treated as a miss.
   * If found and valid, it is refreshed to the most-recently-used position.
   */
  get(key) {
    if (!this.cache.has(key)) {
      this.metrics.misses++;
      return undefined;
    }

    const entry = this.cache.get(key);
    const now = Date.now();

    if (entry.expiresAt && entry.expiresAt <= now) {
      this.cache.delete(key);
      this.metrics.misses++;
      return undefined;
    }

    // Refresh LRU order (delete and re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.metrics.hits++;
    return entry.value;
  }

  /**
   * Stores an item with bounded capacity and LRU eviction.
   */
  set(key, value, customTtlMs) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least-recently-used (first key in iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        this.metrics.evictions++;
      }
    }

    const ttl = typeof customTtlMs === 'number' ? customTtlMs : this.ttlMs;
    const expiresAt = ttl > 0 ? Date.now() + ttl : null;

    this.cache.set(key, { value, expiresAt });
    this.metrics.sets++;
    return value;
  }

  /**
   * Coalesced fetch: prevents duplicate concurrent database queries for the same key.
   * @param {string} key
   * @param {Function} fetcher Async function returning the authoritative value
   * @param {number} [customTtlMs]
   */
  async getOrSet(key, fetcher, customTtlMs) {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Single-flight coalescing for simultaneous requests
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        if (result !== undefined && result !== null) {
          this.set(key, result, customTtlMs);
        }
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Invalidate a single key
   */
  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.metrics.invalids++;
      return true;
    }
    return false;
  }

  /**
   * Invalidate all keys matching a prefix or regex pattern
   */
  invalidatePattern(pattern) {
    let count = 0;
    const isRegex = pattern instanceof RegExp;
    for (const key of Array.from(this.cache.keys())) {
      const match = isRegex ? pattern.test(key) : String(key).startsWith(pattern);
      if (match) {
        this.cache.delete(key);
        count++;
      }
    }
    this.metrics.invalids += count;
    return count;
  }

  /**
   * Invalidate all entries
   */
  clear() {
    const count = this.cache.size;
    this.cache.clear();
    this.inFlight.clear();
    this.metrics.invalids += count;
  }

  /**
   * Clean expired entries manually if desired
   */
  pruneExpired() {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Returns safe operational statistics without leaking cached content
   */
  getStats() {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) : 0;
    return {
      name: this.name,
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate: Number((hitRate * 100).toFixed(2)),
      evictions: this.metrics.evictions,
      invalidations: this.metrics.invalids
    };
  }
}

// Global bounded caches for read-heavy operations:
// 1. Student metadata cache (indexed by SAP ID and database ID). Max 500 entries, 5 min TTL.
export const studentCache = new BoundedLRUCache({
  name: 'students',
  maxSize: 500,
  ttlMs: 5 * 60 * 1000
});

// 2. Timetable weekly template slots cache (by className). Max 100 entries, 15 min TTL.
export const timetableCache = new BoundedLRUCache({
  name: 'timetable_slots',
  maxSize: 100,
  ttlMs: 15 * 60 * 1000
});

/**
 * Invalidate student cache entries by database ID, SAP ID, or clear all if unspecifiable.
 * Ensures consistent multi-key invalidation across dual index patterns (id: and sap:).
 *
 * @param {Object} [identifiers]
 * @param {string} [identifiers.id]
 * @param {string} [identifiers.sapId]
 */
export function invalidateStudentCache({ id, sapId } = {}) {
  const hasId = Boolean(id && String(id).trim());
  const hasSap = Boolean(sapId && String(sapId).trim());

  if (!hasId && !hasSap) {
    // If affected student cannot be determined reliably, clear entire student cache safely
    studentCache.clear();
    return;
  }

  if (hasId) {
    const idStr = String(id).trim();
    studentCache.delete(`id:${idStr}`);
    studentCache.delete(`sap:${idStr}`);
  }

  if (hasSap) {
    const sapStr = String(sapId).trim();
    studentCache.delete(`sap:${sapStr}`);
    studentCache.delete(`id:${sapStr}`);
  }
}

