// Single place that loads the Firebase SDK (modular v10, straight from Google's CDN, no build step).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Offline-first: reads come from the local cache and writes sync when the connection returns.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export * from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
export * from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
