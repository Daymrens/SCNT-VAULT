import { db } from '../firebase/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { isQuotaError, getLocalNumber } from './offlineQueue';

const pad = (n) => String(n).padStart(4, '0');

async function nextNumber(database, type, prefix) {
  const year = new Date().getFullYear();
  const counterRef = doc(database, 'counters', `${type}-${year}`);
  let seq;
  try {
    seq = await runTransaction(database, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? Number(snap.data().seq || 0) : 0;
      const next = current + 1;
      await tx.set(counterRef, { seq: next });
      return next;
    });
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn('[quota] ' + prefix + ' number falls back to local');
      return getLocalNumber(prefix);
    }
    throw err;
  }
  return `${prefix}-${year}-${pad(seq)}`;
}

export async function nextInvoiceNumber(database = db) {
  return nextNumber(database, 'invoice', 'SCNT-INV');
}

export async function nextOrderNumber(database = db) {
  return nextNumber(database, 'order', 'SCNT-ORDER');
}
