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
  increment
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from './AuthContext';
import { isQuotaError, getLocalSaleId, enqueuePendingWrite, readPendingWrites, removePendingWrite } from '../utils/offlineQueue';

const DataContext = createContext();

export function useData() {
  return useContext(DataContext);
}

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
    const flush = async () => {
      const pending = readPendingWrites().filter((w) => w.type === 'sale');
      for (const w of pending) {
        try {
          const { _localId, stockDeltas, ...data } = w.data;
          await addDoc(collection(db, 'sales'), data);
          if (Array.isArray(stockDeltas) && stockDeltas.length) {
            for (const d of stockDeltas) {
              if (!d || !d.productId) continue;
              await updateDoc(doc(db, 'products', d.productId), { Stock: increment(Number(d.delta) || 0) });
            }
          }
          removePendingWrite(w.ts);
          retryCountsRef.current.delete(w.ts);
        } catch (err) {
          if (isQuotaError(err)) {
            continue;
          }
          const attempts = (retryCountsRef.current.get(w.ts) || 0) + 1;
          retryCountsRef.current.set(w.ts, attempts);
          if (attempts >= 5) {
            console.error('[flush] permanently dropping pending sale after 5 failed attempts:', w.ts, err);
            removePendingWrite(w.ts);
            retryCountsRef.current.delete(w.ts);
          } else {
            console.warn(`[flush] retrying pending sale (attempt ${attempts}/5):`, w.ts, err);
          }
        }
      }
    };
    flush();
    const flushTimer = setInterval(flush, 60000);
    return () => clearInterval(flushTimer);
  }, []);

  const loadSales = () => {
    if (salesLoadedRef.current) return;
    salesLoadedRef.current = true;
    onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error loading sales:', error);
      setSales([]);
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
      if (isQuotaError(err)) {
        console.warn('[quota] product stock update skipped (offline):', id);
        return;
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
      if (isQuotaError(err)) {
        console.warn('[quota] stock adjustment skipped (offline):', productId, delta);
        return;
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
    try {
      const docRef = await addDoc(collection(db, 'sales'), payload);
      return docRef.id;
    } catch (err) {
      if (isQuotaError(err)) {
        const localId = getLocalSaleId();
        const queued = { ...payload, _localId: localId };
        if (Array.isArray(opts.stockDeltas) && opts.stockDeltas.length) {
          queued.stockDeltas = opts.stockDeltas;
        }
        enqueuePendingWrite('sale', queued);
        console.warn('[quota] sale saved locally; will sync later:', localId);
        return localId;
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
    loadPurchaseOrders
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}
