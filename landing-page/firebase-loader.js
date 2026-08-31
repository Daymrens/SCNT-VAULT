// Firebase Loader - Optional, non-blocking
// This script loads Firebase services without blocking the main app

(async function() {
    try {
        console.log('🔥 Loading Firebase services...');
        
        // Import Firebase service module
        const firebaseModule = await import('./firebase-service.js');
        
        // Make Firebase functions available globally
        window.createOrder = firebaseModule.createOrder;
        window.saveContactMessage = firebaseModule.saveContactMessage;
        window.subscribeNewsletter = firebaseModule.subscribeNewsletter;
        window.trackPageView = firebaseModule.trackPageView;
        window.trackProductView = firebaseModule.trackProductView;
        
        console.log('✅ Firebase services loaded and ready');
        
        // Dispatch event to notify that Firebase is ready
        window.dispatchEvent(new Event('firebaseReady'));
        
    } catch (error) {
        console.warn('⚠️ Firebase services not available:', error.message);
        console.log('📝 App will work without Firebase (orders won\'t be saved to database)');
        
        // Create dummy functions so the app doesn't break
        window.createOrder = async () => console.log('Firebase not available - order not saved');
        window.saveContactMessage = async () => console.log('Firebase not available - message not saved');
        window.subscribeNewsletter = async () => console.log('Firebase not available - subscription not saved');
        window.trackPageView = () => {};
        window.trackProductView = () => {};
    }
})();
