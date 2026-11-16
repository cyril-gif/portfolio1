// Small in-memory rate limiter (no extra dependency). Good enough for a single
// Render instance. Counts are per client IP.

export function createBucket(windowMs, max) {
  const entries = new Map();

  const prune = () => {
    const now = Date.now();
    for (const [key, e] of entries) if (e.reset <= now) entries.delete(key);
  };
  setInterval(prune, Math.min(windowMs, 60_000)).unref();

  const current = (key) => {
    const e = entries.get(key);
    return e && e.reset > Date.now() ? e : null;
  };

  return {
    hit(key) {
      let e = current(key);
      if (!e) {
        e = { count: 0, reset: Date.now() + windowMs };
        entries.set(key, e);
      }
      e.count += 1;
      return e;
    },
    isLimited: (key) => (current(key)?.count ?? 0) >= max,
    retryAfterSeconds: (key) => Math.max(1, Math.ceil(((current(key)?.reset ?? Date.now()) - Date.now()) / 1000)),
    clear: (key) => entries.delete(key)
  };
}

// Express middleware: allow `max` requests per `windowMs` per IP.
export function rateLimit({ windowMs, max, message = 'Too many requests. Please try again later.' }) {
  const bucket = createBucket(windowMs, max);
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const entry = bucket.hit(key);
    if (entry.count > max) {
      res.set('Retry-After', String(bucket.retryAfterSeconds(key)));
      return res.status(429).json({ success: false, error: message });
    }
    next();
  };
}
