import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  where,
  getDoc,
  Timestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from './AuthContext';
import { isQuotaError, isOfflineError, enqueuePendingWrite, readPendingWrites, removePendingWrite } from '../utils/offlineQueue';
import { toastBus } from '../components/shared/Toast';

const DataContext = createContext();

export function useData() {
  return useContext(DataContext);
}

// Guard: only toast subscription errors once for unauthenticated users
let _subWarned = false;

export function DataProvider({ children }) {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [testers, setTesters] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = React.useRef(new Set());
  const salesLoadedRef = React.useRef(false);
  const poLoadedRef = React.useRef(false);
  const COLLECTIONS = ['products','suppliers','customers','resellers','testers'];

  useEffect(() => {
    loadedRef.current = new Set();
    salesLoadedRef.current = false;
    poLoadedRef.current = false;
    const unsubscribers = [];

    const onLoaded = (name) => {
      loadedRef.current.add(name);
      if (loadedRef.current.size >= COLLECTIONS.length) setLoading(false);
    };

    const subscribe = (name, path, setter) => {
      unsubscribers.push(
        onSnapshot(collection(db, path), (snapshot) => {
          setter(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          onLoaded(name);
        }, (error) => {
          console.error(`Error loading ${name}:`, error);
          setter([]);
          onLoaded(name);
          if (currentUser && !_subWarned) {
            _subWarned = true;
            toastBus.fire(`Failed to load ${name} — check connection`, 'error');
          }
        })
      );
    };

    subscribe('products',       'products',       setProducts);
    subscribe('suppliers',      'suppliers',      setSuppliers);
    subscribe('customers',      'customers',      setCustomers);
    subscribe('resellers',      'resellers',      setResellers);
    subscribe('testers',        'testers',        setTesters);

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'orders'), where('posReady', '==', true)),
        (snapshot) => {
          setReadyOrders(snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(o => o.posHandled !== true));
        },
        (error) => {
          console.error('Error loading ready orders:', error);
          setReadyOrders([]);
        }
      )
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const retryCountsRef = React.useRef(new Map());

  useEffect(() => {
    if (!currentUser) return undefined;
    const flush = async () => {
      const pending = readPendingWrites().filter((w) => w.type === 'sale' && (!w.ownerUid || w.ownerUid === currentUser.uid));
      for (const w of pending) {
        try {
          const { _localId, stockDeltas, ...data } = w.data;
          await persistSale(_localId, data, stockDeltas);
          removePendingWrite(w.id ?? w.ts);
          retryCountsRef.current.delete(w.id ?? w.ts);
        } catch (err) {
          if (isQuotaError(err)) {
            continue;
          }
          const retryKey = w.id ?? w.ts;
          const attempts = (retryCountsRef.current.get(retryKey) || 0) + 1;
          retryCountsRef.current.set(retryKey, attempts);
          console.warn(`[flush] retaining pending sale after failed sync (attempt ${attempts}):`, w.ts, err);
        }
      }
    };
    flush();
    const flushTimer = setInterval(flush, 60000);
    return () => clearInterval(flushTimer);
  }, [currentUser]);

  const persistSale = async (saleId, payload, stockDeltas = []) => {
    const saleRef = doc(db, 'sales', saleId);
    const deltasByProduct = new Map();
    for (const item of Array.isArray(stockDeltas) ? stockDeltas : []) {
      if (!item?.productId) continue;
      deltasByProduct.set(item.productId, (deltasByProduct.get(item.productId) || 0) + (Number(item.delta) || 0));
    }
    const movements = [...deltasByProduct.entries()].filter(([, delta]) => delta !== 0).map(([productId, delta]) => {
      const movementId = `sale_${encodeURIComponent(saleId)}_${encodeURIComponent(productId)}`;
      return {
        productId,
        delta,
        movementRef: doc(db, 'stockMovements', movementId),
        productRef: doc(db, 'products', productId),
      };
    });

    await runTransaction(db, async (transaction) => {
      const saleSnapshot = await transaction.get(saleRef);
      const snapshots = await Promise.all(movements.map(async (movement) => ({
        movement,
        marker: await transaction.get(movement.movementRef),
        product: await transaction.get(movement.productRef),
      })));

      if (!saleSnapshot.exists()) transaction.set(saleRef, payload);
      for (const { movement, marker, product } of snapshots) {
        if (marker.exists()) continue;
        if (!product.exists()) throw new Error(`Cannot apply sale stock change: product ${movement.productRef.id} does not exist`);
        transaction.update(movement.productRef, { Stock: increment(movement.delta) });
        transaction.set(movement.movementRef, {
          ProductId: movement.productRef.id,
          Type: 'Sale',
          ReferenceId: saleId,
          Quantity: Math.abs(movement.delta),
          Delta: movement.delta,
          createdAt: Timestamp.now(),
        });
      }
    });
  };

  const applyStockDeltaOnce = async (productId, delta, operationId, type = 'Purchase Order', options = {}) => {
    const markerId = `${encodeURIComponent(operationId)}_${encodeURIComponent(productId)}`;
    const markerRef = doc(db, 'stockMovements', markerId);
    const productRef = doc(db, 'products', productId);
    await runTransaction(db, async (transaction) => {
      const marker = await transaction.get(markerRef);
      if (marker.exists()) return;
      const product = await transaction.get(productRef);
      if (!product.exists()) throw new Error(`Product ${productId} does not exist`);
      const requestedDelta = Number(delta) || 0;
      const currentStock = Number(product.data().Stock) || 0;
      const actualDelta = options.clampAtZero && requestedDelta < 0
        ? -Math.min(Math.abs(requestedDelta), Math.max(0, currentStock))
        : requestedDelta;
      if (actualDelta !== 0) transaction.update(productRef, { Stock: increment(actualDelta) });
      transaction.set(markerRef, {
        ProductId: productId,
        Type: type,
        ReferenceId: operationId,
        Quantity: Math.abs(actualDelta),
        Delta: actualDelta,
        createdAt: Timestamp.now(),
      });
    });
  };

  const loadSales = () => {
    if (salesLoadedRef.current) return;
    salesLoadedRef.current = true;
    onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error loading sales:', error);
      setSales([]);
      if (currentUser) {
        toastBus.fire('Failed to load sales — check connection', 'error');
      }
    });
  };

  const loadPurchaseOrders = () => {
    if (poLoadedRef.current) return;
    poLoadedRef.current = true;
    onSnapshot(collection(db, 'purchaseOrders'), (snapshot) => {
      setPurchaseOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error loading purchaseOrders:', error);
      setPurchaseOrders([]);
      if (currentUser) {
        toastBus.fire('Failed to load purchase orders — check connection', 'error');
      }
    });
  };

  // Product CRUD operations
  const addProduct = async (product) => {
    const docRef = await addDoc(collection(db, 'products'), {
      ...product,
      Stock: product.Stock || 0,
      LowStockThreshold: product.LowStockThreshold || 10,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  };

  const updateProduct = async (id, product) => {
    const docRef = doc(db, 'products', id);
    try {
      await updateDoc(docRef, {
        ...product,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      if (isQuotaError(err) || isOfflineError(err)) {
        toastBus.fire('Could not save product changes. Check your connection and retry.', 'error');
      }
      throw err;
    }
  };

  const deleteProduct = async (id) => {
    await deleteDoc(doc(db, 'products', id));
  };

  const adjustStock = async (productId, delta) => {
    const docRef = doc(db, 'products', productId);
    try {
      await updateDoc(docRef, { Stock: increment(delta) });
    } catch (err) {
      if (isQuotaError(err) || isOfflineError(err)) {
        toastBus.fire('Could not update stock. Check your connection and retry.', 'error');
      }
      throw err;
    }
  };

  // Supplier CRUD operations
  const addSupplier = async (supplier) => {
    const docRef = await addDoc(collection(db, 'suppliers'), {
      ...supplier,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  };

  const updateSupplier = async (id, supplier) => {
    await updateDoc(doc(db, 'suppliers', id), supplier);
  };

  const deleteSupplier = async (id) => {
    await deleteDoc(doc(db, 'suppliers', id));
  };

  // Customer CRUD operations
  const addCustomer = async (customer) => {
    const docRef = await addDoc(collection(db, 'customers'), {
      ...customer,
      LoyaltyPoints: customer.LoyaltyPoints || 0,
      RegisteredDate: Timestamp.now()
    });
    return docRef.id;
  };

  const updateCustomer = async (id, customer) => {
    await updateDoc(doc(db, 'customers', id), customer);
  };

  const deleteCustomer = async (id) => {
    await deleteDoc(doc(db, 'customers', id));
  };

  // Reseller CRUD operations
  const addReseller = async (reseller) => {
    const docRef = await addDoc(collection(db, 'resellers'), {
      ...reseller,
      DiscountRate: reseller.DiscountRate || 0,
      TotalPurchases: reseller.TotalPurchases || 0,
      IsActive: reseller.IsActive !== undefined ? reseller.IsActive : true,
      RegisteredDate: Timestamp.now()
    });
    return docRef.id;
  };

  const updateReseller = async (id, reseller) => {
    await updateDoc(doc(db, 'resellers', id), reseller);
  };

  const deleteReseller = async (id) => {
    await deleteDoc(doc(db, 'resellers', id));
  };

  // Sale CRUD operations
  const addSale = async (sale, opts = {}) => {
    const payload = { ...sale, SaleDate: sale.SaleDate || Timestamp.now(), createdAt: Timestamp.now() };
    const saleId = doc(collection(db, 'sales')).id;
    try {
      await persistSale(saleId, payload, opts.stockDeltas);
      return saleId;
    } catch (err) {
      if (isQuotaError(err) || isOfflineError(err)) {
        const queued = { ...payload, _localId: saleId };
        if (Array.isArray(opts.stockDeltas) && opts.stockDeltas.length) {
          queued.stockDeltas = opts.stockDeltas;
        }
        if (!enqueuePendingWrite('sale', queued, currentUser?.uid || null)) {
          throw new Error('Sale could not be saved locally. Keep this checkout open and retry when storage is available.');
        }
        console.warn('[quota] sale saved locally; will sync later:', saleId);
        toastBus.fire('Saved locally — will sync when back online', 'info');
        return saleId;
      }
      throw err;
    }
  };

  const updateSale = async (id, sale) => {
    await updateDoc(doc(db, 'sales', id), sale);
  };

  const deleteSale = async (id) => {
    await deleteDoc(doc(db, 'sales', id));
  };

  // Purchase Order CRUD operations
  const addPurchaseOrder = async (order) => {
    const docRef = await addDoc(collection(db, 'purchaseOrders'), {
      ...order,
      OrderDate: order.OrderDate || Timestamp.now(),
      Status: order.Status || 'Pending',
      createdAt: Timestamp.now()
    });
    return docRef.id;
  };

  const updatePurchaseOrder = async (id, order) => {
    await updateDoc(doc(db, 'purchaseOrders', id), order);
  };

  const deletePurchaseOrder = async (id) => {
    await deleteDoc(doc(db, 'purchaseOrders', id));
  };

  // Tester CRUD operations
  const addTester = async (tester) => {
    const docRef = await addDoc(collection(db, 'testers'), {
      ...tester,
      Status: tester.Status || 'Available',
      CreatedDate: Timestamp.now()
    });
    return docRef.id;
  };

  const updateTester = async (id, tester) => {
    await updateDoc(doc(db, 'testers', id), tester);
  };

  const deleteTester = async (id) => {
    await deleteDoc(doc(db, 'testers', id));
  };

  // Order operations (read-only subscription in readyOrders; used by POS fulfillment)
  const updateOrder = async (id, order) => {
    await updateDoc(doc(db, 'orders', id), order);
  };

  const getOrder = async (id) => {
    const snapshot = await getDoc(doc(db, 'orders', id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  };

  const addBulkProducts = async (productsArray) => {
    const results = { success: 0, errors: [] };
    for (const product of productsArray) {
      try {
        await addDoc(collection(db, 'products'), {
          ...product,
          Stock: product.Stock || 0,
          LowStockThreshold: product.LowStockThreshold || 10,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        results.success++;
      } catch (err) {
        results.errors.push({ row: product, error: err.message });
      }
    }
    return results;
  };

  const applyStockAdjustments = async (adjustmentsArray) => {
    const results = { success: 0, errors: [] };
    for (const adj of adjustmentsArray) {
      try {
        const product = products.find(p => 
          p.BatchNumber === adj.SKU || p.id === adj.SKU
        );
        if (!product) {
          results.errors.push({ row: adj, error: 'Product not found' });
          continue;
        }
        await updateDoc(doc(db, 'products', product.id), { Stock: increment(adj.Adjustment) });
        await logStockMovement({
          productId: product.id,
          productName: product.Name,
          sku: product.BatchNumber || product.id,
          type: adj.Adjustment > 0 ? 'in' : 'out',
          quantity: Math.abs(adj.Adjustment),
          reference: 'CSV Import',
          notes: adj.Notes || 'Bulk stock adjustment'
        });
        results.success++;
      } catch (err) {
        results.errors.push({ row: adj, error: err.message });
      }
    }
    return results;
  };

  const value = {
    products,
    suppliers,
    customers,
    resellers,
    sales,
    purchaseOrders,
    testers,
    readyOrders,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    applyStockDeltaOnce,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addReseller,
    updateReseller,
    deleteReseller,
    addSale,
    updateSale,
    deleteSale,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    addTester,
    updateTester,
    deleteTester,
    updateOrder,
    getOrder,
    loadSales,
    loadPurchaseOrders,
    addBulkProducts,
    applyStockAdjustments
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}
