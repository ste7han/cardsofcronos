import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

/**
 * Spelers hebben geen account, maar de Firestore-regels moeten wel kunnen zien
 * WIE er schrijft — anders is `request.auth` altijd null en kan een regel niets
 * afdwingen. Anonieme auth geeft elke browser een stabiele uid.
 *
 * Await dit vóór elke Firestore-schrijfactie vanuit de arena.
 * Vereist dat de Anonymous-provider aanstaat in de Firebase-console.
 */
export const authReady: Promise<string | null> =
  typeof window === 'undefined'
    ? Promise.resolve(null)
    : new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            unsubscribe();
            resolve(user.uid);
            return;
          }
          // Alleen anoniem inloggen als er nog niemand is. Onvoorwaardelijk
          // aanroepen zou een ingelogde admin vervangen door een anonieme user.
          signInAnonymously(auth).catch((error) => {
            console.error('Anonymous sign-in failed — Firestore writes will be denied.', error);
            unsubscribe();
            resolve(null);
          });
        });
      });

export { app, db, storage, auth };
