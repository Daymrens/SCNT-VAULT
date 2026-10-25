// Firebase Configuration
// Import Firebase SDK modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getFirestore, 
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
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCTVEb364hJZveBr0iUu5a39TpgcBb63no",
    authDomain: "scnt-vault.firebaseapp.com",
    databaseURL: "https://scnt-vault-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "scnt-vault",
    storageBucket: "scnt-vault.firebasestorage.app",
    messagingSenderId: "86926234856",
    appId: "1:86926234856:web:75d5119f0b4f54ff3fe55d",
    measurementId: "G-696C1WTS9G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);

console.log('✅ Firebase initialized successfully');
console.log('✅ Firestore database ready');

// Export Firebase services
export { 
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
    runTransaction,
    analytics 
};
