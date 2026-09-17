import { Timestamp } from 'firebase/firestore';

const PENDING_KEY = 'scnt_pending_writes';

export function isQuotaError(err) {
  if (!err) return false;
  if (err.code === 'resource-exhausted') return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('quota') || msg.includes('exceeded') || msg.includes('limit') || msg.includes('429');
}

function rand4() { return Math.random().toString(36).slice(2, 6).toUpperCase(); }

export function getLocalNumber(prefix) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `${prefix}-LOCAL-${ts}-${rand4()}`;
}

export function getLocalSaleId() {
  return `SCNT-LOCAL-SALE-${Date.now()}-${rand4()}`;
}

const isTimestampLike = (v) =>
  !!v &&
  (typeof v.toDate === 'function' ||
    (typeof v === 'object' && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'));

function encodeValue(v) {
  if (isTimestampLike(v)) {
    const ts = v.toDate ? { seconds: v.seconds, nanoseconds: v.nanoseconds } : v;
    return { __ts: true, seconds: ts.seconds, nanoseconds: ts.nanoseconds };
  }
  if (Array.isArray(v)) return v.map(encodeValue);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = encodeValue(v[k]);
    return out;
  }
  return v;
}

function decodeValue(v) {
  if (v && typeof v === 'object' && v.__ts === true) {
    return new Timestamp(v.seconds, v.nanoseconds);
  }
  if (Array.isArray(v)) return v.map(decodeValue);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = decodeValue(v[k]);
    return out;
  }
  return v;
}

export function enqueuePendingWrite(type, data) {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ type, data: encodeValue(data), ts: Date.now() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
  } catch (e) { console.warn('enqueuePendingWrite failed', e); }
}

export function readPendingWrites() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw).map((w) => ({ ...w, data: decodeValue(w.data) })) : [];
  }
  catch { return []; }
}

export function removePendingWrite(ts) {
  try {
    const arr = readPendingWrites().filter((w) => w.ts !== ts);
    localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
  } catch {}
}
