import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ActivityEntry, CalcNote, Loan, Plan, Settings, Transaction } from '../types';
import { getFirebase } from '../lib/firebase';
import { defaultSettings, type Backend, type CommitResult, type DataSnapshot, type Op } from './backend';

const COL = { tx: 'transactions', loan: 'loans', activity: 'activity', history: 'history', note: 'notes', plan: 'plans' } as const;

export interface CloudCallbacks {
  onData: (patch: Partial<DataSnapshot>) => void;
  /** Every listener delivered a first snapshot (possibly from the offline cache). */
  onLoaded: () => void;
  /** Every listener has confirmed its data with the server (authoritative). */
  onServerSynced: (info: { empty: boolean }) => void;
  onPending: (pending: boolean) => void;
  onError: (err: Error) => void;
}

/** Newer sections need the latest firestore.rules; explain that instead of a bare "permission denied". */
function sectionRulesError(e: Error & { code?: string }): Error {
  if (e.code === 'permission-denied')
    return new Error('Calculation Notes and Investments need the updated database rules: paste the latest firestore.rules into Firebase → Firestore → Rules and click Publish. Your other data is fine.');
  return e;
}

const delay = (ms: number) => new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms));

/** Firestore batches are limited to 500 writes. */
const BATCH_LIMIT = 450;

export function createCloudBackend(uid: string, cb: CloudCallbacks): Backend {
  const { db } = getFirebase();
  const base = `users/${uid}`;
  const unsubs: Unsubscribe[] = [];
  const pending: Record<string, boolean> = {};
  const loaded = new Set<string>();
  const synced = new Map<string, boolean>(); // name -> empty
  let loadedFired = false;
  let syncedFired = false;
  const names = ['tx', 'loan', 'note', 'plan', 'activity', 'user'];

  const track = (name: string, empty: boolean, fromCache: boolean, hasPendingWrites: boolean) => {
    pending[name] = hasPendingWrites;
    cb.onPending(Object.values(pending).some(Boolean));
    loaded.add(name);
    if (!fromCache && !synced.has(name)) synced.set(name, empty);
    if (!loadedFired && names.every((n) => loaded.has(n))) {
      loadedFired = true;
      cb.onLoaded();
    }
    if (!syncedFired && names.every((n) => synced.has(n))) {
      syncedFired = true;
      cb.onServerSynced({ empty: !!(synced.get('tx') && synced.get('loan')) });
    }
  };
  const opts = { includeMetadataChanges: true };

  unsubs.push(
    onSnapshot(
      collection(db, base, COL.tx),
      opts,
      (snap) => {
        cb.onData({ transactions: snap.docs.map((d) => d.data() as Transaction) });
        track('tx', snap.empty, snap.metadata.fromCache, snap.metadata.hasPendingWrites);
      },
      (e) => cb.onError(e),
    ),
    onSnapshot(
      collection(db, base, COL.loan),
      opts,
      (snap) => {
        cb.onData({
          loans: snap.docs.map((d) => {
            const l = d.data() as Loan;
            return { ...l, repayments: l.repayments ?? [] };
          }),
        });
        track('loan', snap.empty, snap.metadata.fromCache, snap.metadata.hasPendingWrites);
      },
      (e) => cb.onError(e),
    ),
    onSnapshot(
      collection(db, base, COL.note),
      opts,
      (snap) => {
        cb.onData({ notes: snap.docs.map((d) => { const n = d.data() as CalcNote; return { ...n, entries: n.entries ?? [] }; }) });
        track('note', snap.empty, snap.metadata.fromCache, snap.metadata.hasPendingWrites);
      },
      (e) => {
        track('note', true, false, false);
        cb.onError(sectionRulesError(e));
      },
    ),
    onSnapshot(
      collection(db, base, COL.plan),
      opts,
      (snap) => {
        cb.onData({ plans: snap.docs.map((d) => { const p = d.data() as Plan; return { ...p, payments: p.payments ?? [] }; }) });
        track('plan', snap.empty, snap.metadata.fromCache, snap.metadata.hasPendingWrites);
      },
      (e) => {
        track('plan', true, false, false);
        cb.onError(sectionRulesError(e));
      },
    ),
    onSnapshot(
      query(collection(db, base, COL.activity), orderBy('at', 'desc'), limit(300)),
      opts,
      (snap) => {
        cb.onData({ activity: snap.docs.map((d) => d.data() as ActivityEntry) });
        track('activity', snap.empty, snap.metadata.fromCache, snap.metadata.hasPendingWrites);
      },
      (e) => cb.onError(e),
    ),
    onSnapshot(
      doc(db, base),
      opts,
      (snap) => {
        const s = snap.data()?.settings as Partial<Settings> | undefined;
        cb.onData({ settings: { ...defaultSettings, ...(s ?? {}) } });
        track('user', !snap.exists(), snap.metadata.fromCache, snap.metadata.hasPendingWrites);
      },
      (e) => cb.onError(e),
    ),
  );

  return {
    mode: 'cloud',
    async commit(ops) {
      const chunks: Op[][] = [];
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) chunks.push(ops.slice(i, i + BATCH_LIMIT));
      let result: CommitResult = 'saved';
      for (const chunk of chunks) {
        const p = writeChunk(db, base, chunk);
        const first = await Promise.race([p.then(() => 'done' as const), delay(6000)]);
        if (first === 'timeout') {
          // Offline: the write is already stored durably on this device and will sync automatically.
          if (!navigator.onLine) {
            result = 'queued';
            p.catch((e) => cb.onError(e));
            continue;
          }
          await p;
        }
      }
      return result;
    },
    stop() {
      unsubs.forEach((u) => u());
    },
  };
}

function writeChunk(db: Firestore, base: string, ops: Op[]) {
  const batch = writeBatch(db);
  for (const o of ops) {
    if (o.kind === 'settings') {
      batch.set(doc(db, base), { settings: o.doc, updatedAt: new Date().toISOString() }, { merge: true });
    } else {
      batch.set(doc(db, base, COL[o.kind], o.doc.id), stripUndefined(o.doc));
    }
  }
  return batch.commit();
}

function stripUndefined<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}
