// Firebase Firestore Service
import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    doc,
    query, 
    where,
    orderBy,
    limit,
    serverTimestamp,
    runTransaction
} from './firebase-config.js';

// ==================== ORDERS ====================

/**
 * Create a new order in Firestore
 * @param {Object} orderData - Order information
 * @returns {Promise<string>} Order ID
 */
export async function createOrder(orderData) {
    try {
        const ordersRef = collection(db, 'orders');
        const year = new Date().getFullYear();
        const counterRef = doc(db, 'counters', 'order-' + year);
        const orderNumber = await runTransaction(db, async (tx) => {
            const snap = await tx.get(counterRef);
            const current = snap.exists() ? Number(snap.data().seq || 0) : 0;
            const next = current + 1;
            await tx.set(counterRef, { seq: next });
            return 'SCNT-ORDER-' + year + '-' + String(next).padStart(4, '0');
        });

        const order = {
            ...orderData,
            OrderNumber: orderNumber,
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(ordersRef, order);
        console.log('✅ Order created:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('❌ Error creating order:', error);
        throw error;
    }
}

/**
 * Get all orders
 * @returns {Promise<Array>} Array of orders
 */
export async function getAllOrders() {
    try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const orders = [];
        querySnapshot.forEach((doc) => {
            orders.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return orders;
    } catch (error) {
        console.error('❌ Error fetching orders:', error);
        throw error;
    }
}

/**
 * Get orders by email
 * @param {string} email - Customer email
 * @returns {Promise<Array>} Array of orders
 */
export async function getOrdersByEmail(email) {
    try {
        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef, 
            where('email', '==', email),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        const orders = [];
        querySnapshot.forEach((doc) => {
            orders.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return orders;
    } catch (error) {
        console.error('❌ Error fetching orders by email:', error);
        throw error;
    }
}

/**
 * Get orders by status
 * @param {string} status - Order status (pending, confirmed, shipped, delivered, cancelled)
 * @returns {Promise<Array>} Array of orders
 */
export async function getOrdersByStatus(status) {
    try {
        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef, 
            where('status', '==', status),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        const orders = [];
        querySnapshot.forEach((doc) => {
            orders.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return orders;
    } catch (error) {
        console.error('❌ Error fetching orders by status:', error);
        throw error;
    }
}

// ==================== CONTACTS ====================

/**
 * Save contact form submission
 * @param {Object} contactData - Contact form data
 * @returns {Promise<string>} Contact ID
 */
export async function saveContactMessage(contactData) {
    try {
        const contactsRef = collection(db, 'contacts');
        
        const contact = {
            ...contactData,
            createdAt: serverTimestamp(),
            status: 'unread'
        };
        
        const docRef = await addDoc(contactsRef, contact);
        console.log('✅ Contact message saved:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('❌ Error saving contact message:', error);
        throw error;
    }
}

/**
 * Get all contact messages
 * @returns {Promise<Array>} Array of contacts
 */
export async function getAllContacts() {
    try {
        const contactsRef = collection(db, 'contacts');
        const q = query(contactsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const contacts = [];
        querySnapshot.forEach((doc) => {
            contacts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return contacts;
    } catch (error) {
        console.error('❌ Error fetching contacts:', error);
        throw error;
    }
}

// ==================== PERFUMES ====================

/**
 * Upload perfumes data to Firestore (one-time migration)
 * @param {Array} perfumesData - Array of perfume objects
 * @returns {Promise<void>}
 */
export async function uploadPerfumesData(perfumesData) {
    try {
        const perfumesRef = collection(db, 'perfumes');
        
        console.log('📤 Starting perfumes upload...');
        let count = 0;
        
        for (const perfume of perfumesData) {
            await addDoc(perfumesRef, {
                ...perfume,
                createdAt: serverTimestamp()
            });
            count++;
            if (count % 10 === 0) {
                console.log(`✅ Uploaded ${count}/${perfumesData.length} perfumes`);
            }
        }
        
        console.log(`✅ All ${count} perfumes uploaded successfully!`);
    } catch (error) {
        console.error('❌ Error uploading perfumes:', error);
        throw error;
    }
}

/**
 * Get all perfumes from Firestore
 * @returns {Promise<Array>} Array of perfumes
 */
export async function getAllPerfumes() {
    try {
        const perfumesRef = collection(db, 'perfumes');
        const querySnapshot = await getDocs(perfumesRef);
        
        const perfumes = [];
        querySnapshot.forEach((doc) => {
            perfumes.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`✅ Fetched ${perfumes.length} perfumes from Firestore`);
        return perfumes;
    } catch (error) {
        console.error('❌ Error fetching perfumes:', error);
        throw error;
    }
}

/**
 * Get perfumes by gender
 * @param {string} gender - Gender filter (Women, Men, Unisex)
 * @returns {Promise<Array>} Array of perfumes
 */
export async function getPerfumesByGender(gender) {
    try {
        const perfumesRef = collection(db, 'perfumes');
        const q = query(
            perfumesRef, 
            where('Gender', '==', gender),
            orderBy('Name', 'asc')
        );
        const querySnapshot = await getDocs(q);
        
        const perfumes = [];
        querySnapshot.forEach((doc) => {
            perfumes.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return perfumes;
    } catch (error) {
        console.error('❌ Error fetching perfumes by gender:', error);
        throw error;
    }
}

/**
 * Get perfumes by category
 * @param {string} category - Category filter
 * @returns {Promise<Array>} Array of perfumes
 */
export async function getPerfumesByCategory(category) {
    try {
        const perfumesRef = collection(db, 'perfumes');
        const q = query(
            perfumesRef, 
            where('Category', '==', category),
            orderBy('Name', 'asc')
        );
        const querySnapshot = await getDocs(q);
        
        const perfumes = [];
        querySnapshot.forEach((doc) => {
            perfumes.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return perfumes;
    } catch (error) {
        console.error('❌ Error fetching perfumes by category:', error);
        throw error;
    }
}

// ==================== NEWSLETTER ====================

/**
 * Save newsletter subscription
 * @param {string} email - Subscriber email
 * @returns {Promise<string>} Subscription ID
 */
export async function subscribeNewsletter(email) {
    try {
        const newsletterRef = collection(db, 'newsletter');
        
        const subscription = {
            email: email,
            subscribedAt: serverTimestamp(),
            status: 'active'
        };
        
        const docRef = await addDoc(newsletterRef, subscription);
        console.log('✅ Newsletter subscription saved:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('❌ Error saving newsletter subscription:', error);
        throw error;
    }
}

// ==================== ANALYTICS ====================

/**
 * Track page view
 * @param {string} pageName - Name of the page
 */
export async function trackPageView(pageName) {
    try {
        const pageViewsRef = collection(db, 'analytics', 'pageViews', pageName);
        await addDoc(pageViewsRef, {
            timestamp: serverTimestamp(),
            page: pageName
        });
    } catch (error) {
        console.error('❌ Error tracking page view:', error);
    }
}

/**
 * Track product view
 * @param {string} productName - Name of the product
 */
export async function trackProductView(productName) {
    try {
        const productViewsRef = collection(db, 'analytics', 'productViews', productName);
        await addDoc(productViewsRef, {
            timestamp: serverTimestamp(),
            product: productName
        });
    } catch (error) {
        console.error('❌ Error tracking product view:', error);
    }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if Firestore is connected
 * @returns {Promise<boolean>}
 */
export async function checkFirestoreConnection() {
    try {
        const testRef = collection(db, 'test');
        await getDocs(query(testRef, limit(1)));
        console.log('✅ Firestore connection successful');
        return true;
    } catch (error) {
        console.error('❌ Firestore connection failed:', error);
        return false;
    }
}

console.log('✅ Firebase Firestore service loaded');
