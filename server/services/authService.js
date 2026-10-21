import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const TOKEN_TTL = '8h';
const revoked = new Map(); // jti -> expiry (ms). In-memory; fine for a single-instance demo.
const attempts = new Map(); // ip -> { count, resetAt }

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

function checkRateLimit(ip) {
  const nowMs = Date.now();
  const a = attempts.get(ip);
  if (a && a.resetAt > nowMs && a.count >= 10) throw new AppError(429, 'Too many attempts. Try again in a few minutes.', 'RATE_LIMITED');
}
function recordFailure(ip) {
  const nowMs = Date.now();
  const a = attempts.get(ip);
  if (!a || a.resetAt <= nowMs) attempts.set(ip, { count: 1, resetAt: nowMs + 15 * 60000 });
  else a.count += 1;
}

export function login(pin, ip = 'unknown') {
  const { staffPin, jwtSecret } = getConfig();
  if (!staffPin || !jwtSecret) throw new AppError(500, 'Server authentication is not configured.', 'AUTH_CONFIG');
  checkRateLimit(ip);
  const ok = typeof pin === 'string' && crypto.timingSafeEqual(sha(pin), sha(staffPin));
  if (!ok) {
    recordFailure(ip);
    throw new AppError(401, 'Incorrect PIN.', 'INVALID_PIN');
  }
  attempts.delete(ip);
  const jti = crypto.randomUUID();
  const token = jwt.sign({ role: 'staff' }, jwtSecret, { expiresIn: TOKEN_TTL, jwtid: jti });
  return { token, expiresIn: TOKEN_TTL };
}

export function verify(token) {
  const { jwtSecret } = getConfig();
  const payload = jwt.verify(token, jwtSecret);
  if (revoked.has(payload.jti)) throw new Error('revoked');
  return payload;
}

export function revoke(payload) {
  revoked.set(payload.jti, payload.exp * 1000);
  for (const [k, exp] of revoked) if (exp < Date.now()) revoked.delete(k);
}
