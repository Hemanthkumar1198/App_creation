/**
 * Firebase wiring. The web config below is *public by design* (it only identifies the
 * project); access to data is enforced server-side by Firestore security rules
 * (see firestore.rules) — every user can read/write only users/{their uid}/**.
 *
 * When no config is supplied at build time the app runs in "device-only" mode.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const cloudEnabled = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebase() {
  if (!cloudEnabled) throw new Error('Cloud sync is not configured');
  if (!app) {
    app = initializeApp(firebaseConfig as Record<string, string>);
    auth = getAuth(app);
    auth.useDeviceLanguage();
    // Offline-first: writes are queued durably in IndexedDB and synced when back online.
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    // Local testing only: `VITE_FIREBASE_EMULATOR=true` talks to the Firebase emulators instead of production.
    if (env.VITE_FIREBASE_EMULATOR === 'true') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
  }
  return { app: app!, auth: auth!, db: db! };
}
