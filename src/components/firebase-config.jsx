import { initializeApp } from 'firebase/app';
import { getMessaging, onMessage } from 'firebase/messaging';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FCM_PROJECT_ID || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

console.log('[Firebase] Initializing with projectId:', firebaseConfig.projectId);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
let messaging = null;
try {
  if ('serviceWorker' in navigator) {
    messaging = getMessaging(app);
    console.log('[Firebase] Messaging initialized successfully');
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize messaging:', error.message);
}

// Listen for foreground messages
if (messaging) {
  onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message received:', payload);
  });
}

export { app, messaging };
export default firebaseConfig;