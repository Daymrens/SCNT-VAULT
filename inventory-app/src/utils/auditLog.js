import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PRODUCT_CREATE: 'PRODUCT_CREATE',
  PRODUCT_UPDATE: 'PRODUCT_UPDATE',
  PRODUCT_DELETE: 'PRODUCT_DELETE',
  ORDER_CREATE: 'ORDER_CREATE',
  STOCK_ADJUST: 'STOCK_ADJUST',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
};

export async function logAction(action, details = {}) {
  try {
    await addDoc(collection(db, 'auditLog'), {
      action,
      details,
      timestamp: new Date(),
      uid: details.uid || null,
      email: details.email || null,
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}
