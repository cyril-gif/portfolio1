import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createBucket } from './rateLimit.js';

const COOKIE = 'pl_admin';
const SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Admin is switched on only when all three settings exist and are strong enough.
// Read lazily so values from .env are always picked up.
export function adminConfig() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.JWT_SECRET || '';
  const problems = [];
  if (!email) problems.push('ADMIN_EMAIL is not set');
  if (password.length < 12) problems.push('ADMIN_PASSWORD must be at least 12 characters');
  if (secret.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  return { enabled: problems.length === 0, email, password, secret, problems };
}

// Constant-time comparison (hashing first makes lengths equal).
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

// Login throttling: 5 failures / 15 min per IP, and 50 / 15 min across everyone.
const perIp = createBucket(15 * 60 * 1000, 5);
const global = createBucket(15 * 60 * 1000, 50);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cookieOptions = (req) => ({
  httpOnly: true, // JavaScript on the page can never read the session
  sameSite: 'strict', // never sent from another site (blocks CSRF)
  secure: req.secure, // https only in production
  path: '/api/admin',
  maxAge: SESSION_MS
});

export async function login(req, res) {
  const cfg = adminConfig();
  if (!cfg.enabled) {
    return res.status(503).json({ success: false, error: 'Admin is not set up yet.', problems: cfg.problems });
  }

  const ip = req.ip || 'unknown';
  if (perIp.isLimited(ip) || global.isLimited('all')) {
    const wait = Math.max(perIp.retryAfterSeconds(ip), global.isLimited('all') ? global.retryAfterSeconds('all') : 0);
    res.set('Retry-After', String(wait));
    return res.status(429).json({
      success: false,
      error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`
    });
  }

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  // Evaluate both so timing never reveals which one was wrong.
  const emailOk = safeEqual(email, cfg.email);
  const passOk = safeEqual(password, cfg.password);

  if (!(emailOk && passOk)) {
    perIp.hit(ip);
    global.hit('all');
    await sleep(700); // slows down guessing
    return res.status(401).json({ success: false, error: 'Incorrect email or password.' });
  }

  perIp.clear(ip);
  const token = jwt.sign({ sub: cfg.email }, cfg.secret, { algorithm: 'HS256', expiresIn: '12h' });
  res.cookie(COOKIE, token, cookieOptions(req));
  return res.json({ success: true, email: cfg.email });
}

export function logout(req, res) {
  res.clearCookie(COOKIE, { ...cookieOptions(req), maxAge: undefined });
  res.json({ success: true });
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function requireAdmin(req, res, next) {
  const cfg = adminConfig();
  if (!cfg.enabled) return res.status(503).json({ success: false, error: 'Admin is not set up yet.', problems: cfg.problems });

  const token = readCookie(req, COOKIE);
  if (!token) return res.status(401).json({ success: false, error: 'Please sign in.' });
  try {
    const payload = jwt.verify(token, cfg.secret, { algorithms: ['HS256'] });
    if (!safeEqual(payload.sub, cfg.email)) throw new Error('subject changed');
    req.admin = { email: payload.sub };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Your session expired. Please sign in again.' });
  }
}
