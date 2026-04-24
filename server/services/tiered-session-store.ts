import session from 'express-session';

/**
 * Two-tier session store: in-memory cache in front of a durable backing store
 * (typically Postgres). Reads try memory first and only hit the backing store
 * on cache miss / expiry. Writes are write-through — durable first, cache
 * updated optimistically. Survives process restarts because the backing store
 * owns the source of truth.
 *
 * Suited for single-replica deployments. For multi-replica, cache invalidation
 * across replicas would need a pub/sub (e.g. Postgres LISTEN/NOTIFY or Redis).
 */

interface CacheEntry {
  data: session.SessionData;
  expiresAt: number;
}

type Cb<T = void> = (err?: any, result?: T) => void;

export class TieredSessionStore extends session.Store {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private backing: session.Store,
    private ttlMs: number = 5 * 60 * 1000, // 5 min hot-cache TTL
    private maxSize: number = 10_000,
  ) {
    super();
  }

  private evictIfFull() {
    if (this.cache.size <= this.maxSize) return;
    // Drop the oldest ~10% of entries. Map iteration order is insertion order,
    // so this approximates LRU without maintaining a separate access queue.
    const toEvict = Math.floor(this.maxSize * 0.1);
    const keys = this.cache.keys();
    for (let i = 0; i < toEvict; i++) {
      const next = keys.next();
      if (next.done) break;
      this.cache.delete(next.value);
    }
  }

  get(sid: string, cb: Cb<session.SessionData | null>) {
    const cached = this.cache.get(sid);
    if (cached && cached.expiresAt > Date.now()) {
      return cb(null, cached.data);
    }
    if (cached) this.cache.delete(sid); // expired

    this.backing.get(sid, (err, data) => {
      if (!err && data) {
        this.cache.set(sid, { data, expiresAt: Date.now() + this.ttlMs });
        this.evictIfFull();
      }
      cb(err, data ?? null);
    });
  }

  set(sid: string, data: session.SessionData, cb?: Cb) {
    this.cache.set(sid, { data, expiresAt: Date.now() + this.ttlMs });
    this.evictIfFull();
    this.backing.set(sid, data, cb);
  }

  destroy(sid: string, cb?: Cb) {
    this.cache.delete(sid);
    this.backing.destroy(sid, cb);
  }

  touch(sid: string, data: session.SessionData, cb?: () => void) {
    const existing = this.cache.get(sid);
    if (existing) {
      existing.data = data;
      existing.expiresAt = Date.now() + this.ttlMs;
    } else {
      this.cache.set(sid, { data, expiresAt: Date.now() + this.ttlMs });
      this.evictIfFull();
    }
    if (this.backing.touch) {
      this.backing.touch(sid, data, cb);
    } else if (cb) {
      cb();
    }
  }

  all(cb: (err: any, all?: Record<string, session.SessionData>) => void) {
    if (this.backing.all) {
      this.backing.all(cb as any);
    } else {
      cb(null, {});
    }
  }

  length(cb: (err: any, length?: number) => void) {
    if (this.backing.length) {
      this.backing.length(cb);
    } else {
      cb(null, this.cache.size);
    }
  }

  clear(cb?: Cb) {
    this.cache.clear();
    if (this.backing.clear) {
      this.backing.clear(cb);
    } else if (cb) {
      cb();
    }
  }
}
