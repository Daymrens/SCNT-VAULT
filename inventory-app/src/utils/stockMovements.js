import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';

export async function logStockMovement({ productId, productName, sku, type, quantity, reference, notes }) {
  try {
    await addDoc(collection(db, 'stockMovements'), {
      ProductId: productId || '',
      ProductName: productName || '',
      SKU: sku || '',
      Type: type, // 'in', 'out', 'adjustment'
      Quantity: quantity,
      Reference: reference || '',
      Notes: notes || '',
      Date: Timestamp.now(),
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error logging stock movement:', error);
  }
}
