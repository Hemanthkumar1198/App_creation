/**
 * Session lifecycle: decides which backend is active (cloud for a signed-in user,
 * or this device when cloud sync is not configured) and wires it to the store.
 */
import { create } from 'zustand';
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  linkWithPopup,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { cloudEnabled, getFirebase } from '../lib/firebase';
import { createLocalBackend, defaultSettings, LOCAL_KEY, MIGRATED_KEY, readLocal, type DataSnapshot } from './backend';
import { createCloudBackend } from './cloud';
import { runDailyAutoBackup, setBackend, useStore } from './useStore';

export interface SessionUser {
  uid: string;
  name: string;
  email: string | null;
  phone: string | null;
  photoURL: string | null;
  providers: string[];
}

interface SessionState {
  status: 'starting' | 'signed-out' | 'signed-in' | 'local';
  user: SessionUser | null;
  /** Data found on this device from before sign-in, offered for upload to the account. */
  migrationOffer: DataSnapshot | null;
  dismissMigration: () => void;
}

export const useSession = create<SessionState>()((set) => ({
  status: 'starting',
  user: null,
  migrationOffer: null,
  dismissMigration: () => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) localStorage.setItem(MIGRATED_KEY, raw);
      localStorage.removeItem(LOCAL_KEY);
    } catch {
      /* ignore */
    }
    set({ migrationOffer: null });
  },
}));

function toSessionUser(u: User): SessionUser {
  return {
    uid: u.uid,
    name: u.displayName || u.phoneNumber || u.email || 'You',
    email: u.email,
    phone: u.phoneNumber,
    photoURL: u.photoURL,
    providers: u.providerData.map((p) => p.providerId),
  };
}

const empty: DataSnapshot = { transactions: [], loans: [], activity: [], settings: defaultSettings };

let started = false;

export function startSession() {
  if (started) return;
  started = true;

  if (!cloudEnabled) {
    const data = readLocal() ?? empty;
    useStore.setState({ ...data, status: 'ready', mode: 'local' });
    setBackend(createLocalBackend(() => pick(useStore.getState()), (s) => useStore.setState(s)));
    useSession.setState({ status: 'local' });
    runDailyAutoBackup();
    return;
  }

  const { auth } = getFirebase();
  onAuthStateChanged(auth, (u) => {
    if (!u) {
      setBackend(null);
      useStore.setState({ ...empty, status: 'idle', mode: null, pendingSync: false, syncError: null });
      useSession.setState({ status: 'signed-out', user: null });
      return;
    }
    const current = useSession.getState().user;
    useSession.setState({ status: 'signed-in', user: toSessionUser(u) });
    if (current?.uid === u.uid) return; // token refresh / profile update — keep listeners
    useStore.setState({ ...empty, status: 'loading', mode: 'cloud' });
    setBackend(
      createCloudBackend(u.uid, {
        onData: (patch) => useStore.setState({ ...patch, syncError: null }),
        onLoaded: () => useStore.setState({ status: 'ready' }),
        onServerSynced: ({ empty: isEmpty }) => {
          const local = readLocal();
          if (isEmpty && local && (local.transactions.length || local.loans.length)) useSession.setState({ migrationOffer: local });
        },
        onPending: (pendingSync) => useStore.setState({ pendingSync }),
        // A failed listener must never leave the app stuck on the loading screen.
        onError: (e) => useStore.setState({ syncError: friendlyError(e), status: 'ready' }),
      }),
    );
  });
}

function pick(s: DataSnapshot): DataSnapshot {
  return { transactions: s.transactions, loans: s.loans, activity: s.activity, settings: s.settings };
}

/* ------------------------------------------------------------- auth actions */

export async function signInWithGoogle() {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Popups are often blocked on mobile / in-app browsers — fall back to a full-page redirect.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}

let verifier: RecaptchaVerifier | null = null;

function getVerifier(containerId: string) {
  const { auth } = getFirebase();
  if (!verifier) verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  return verifier;
}

export function resetVerifier() {
  verifier?.clear();
  verifier = null;
}

/** Sends an OTP. `phone` must be in E.164 form, e.g. +919876543210. */
export async function sendOtp(phone: string, containerId: string): Promise<ConfirmationResult> {
  const { auth } = getFirebase();
  try {
    return await signInWithPhoneNumber(auth, phone, getVerifier(containerId));
  } catch (e) {
    resetVerifier();
    throw e;
  }
}

export async function linkGoogle() {
  const { auth } = getFirebase();
  if (!auth.currentUser) throw new Error('Not signed in');
  await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
  await auth.currentUser.reload();
  useSession.setState({ user: toSessionUser(auth.currentUser) });
}

export async function linkPhone(phone: string, containerId: string): Promise<ConfirmationResult> {
  const { auth } = getFirebase();
  if (!auth.currentUser) throw new Error('Not signed in');
  try {
    return await linkWithPhoneNumber(auth.currentUser, phone, getVerifier(containerId));
  } catch (e) {
    resetVerifier();
    throw e;
  }
}

export async function refreshUser() {
  const { auth } = getFirebase();
  if (!auth.currentUser) return;
  await auth.currentUser.reload();
  useSession.setState({ user: toSessionUser(auth.currentUser) });
}

/** Signs out and wipes this device's offline copy of the account data. */
export async function signOut() {
  const { auth, db } = getFirebase();
  setBackend(null);
  await fbSignOut(auth);
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    /* ignore */
  }
  // A fresh page guarantees no data from the previous account stays in memory.
  window.location.reload();
}

export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-phone-number': 'That phone number looks invalid. Use 10 digits, e.g. 98765 43210.',
    'auth/invalid-verification-code': 'Incorrect OTP. Please check the code and try again.',
    'auth/code-expired': 'This OTP has expired. Please request a new one.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/quota-exceeded': 'SMS limit reached for today. Please sign in with Google or try later.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/network-request-failed': 'No internet connection. Please check your network and retry.',
    'auth/unauthorized-domain': 'This website is not authorised for sign-in yet. Add it under Firebase → Authentication → Settings → Authorised domains.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase → Authentication → Sign-in method.',
    'auth/billing-not-enabled': 'Phone OTP needs the Firebase Blaze plan. Please use Google sign-in, or enable billing in Firebase.',
    'auth/credential-already-in-use': 'That account is already linked to a different Paisa Ledger account.',
    'auth/provider-already-linked': 'This sign-in method is already linked.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email using another sign-in method.',
    'permission-denied': 'Permission denied — please sign in again.',
    unavailable: 'Cannot reach the server. Changes are kept on this device and will sync when you are back online.',
  };
  if (map[code]) return map[code];
  if (e instanceof Error && e.message) return e.message.replace(/^Firebase: /, '').replace(/\(auth\/[^)]+\)\.?/, '').trim() || 'Something went wrong';
  return 'Something went wrong. Please try again.';
}
