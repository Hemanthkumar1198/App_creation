/**
 * Storage backends. All writes go through `commit(ops)`:
 *  - cloud: one atomic Firestore batch per user action (offline-queued, synced later)
 *  - local: device storage (used only when cloud sync is not configured)
 * Document IDs are generated on the client, so retrying a write can never create a duplicate.
 */
import type { ActivityEntry, Loan, Settings, Transaction } from '../types';

export type Op =
  | { kind: 'tx'; op: 'put'; doc: Transaction }
  | { kind: 'loan'; op: 'put'; doc: Loan }
  | { kind: 'activity'; op: 'put'; doc: ActivityEntry }
  | { kind: 'settings'; op: 'put'; doc: Settings }
  | { kind: 'tx' | 'loan' | 'activity'; op: 'delete'; id: string };

/** 'saved' = durably stored (server ack or device storage); 'queued' = stored offline, will sync. */
export type CommitResult = 'saved' | 'queued';

export interface DataSnapshot {
  transactions: Transaction[];
  loans: Loan[];
  activity: ActivityEntry[];
  settings: Settings;
}

export interface Backend {
  mode: 'local' | 'cloud';
  commit(ops: Op[]): Promise<CommitResult>;
  stop(): void;
}

export const defaultSettings: Settings = {
  theme: 'system',
  userName: '',
  reminderDays: 7,
  browserNotifications: false,
  lastPaymentMethod: 'UPI',
};

/** Pure reducer used by the local backend (and tests). */
export function applyOps(state: DataSnapshot, ops: Op[]): DataSnapshot {
  let { transactions, loans, activity, settings } = state;
  for (const o of ops) {
    if (o.op === 'delete') {
      if (o.kind === 'tx') transactions = transactions.filter((x) => x.id !== o.id);
      else if (o.kind === 'loan') loans = loans.filter((x) => x.id !== o.id);
      else activity = activity.filter((x) => x.id !== o.id);
      continue;
    }
    if (o.kind === 'settings') settings = o.doc;
    else if (o.kind === 'tx') transactions = upsert(transactions, o.doc);
    else if (o.kind === 'loan') loans = upsert(loans, o.doc);
    else activity = [o.doc, ...activity.filter((a) => a.id !== o.doc.id)].slice(0, 500);
  }
  return { transactions, loans, activity, settings };
}

function upsert<T extends { id: string }>(list: T[], doc: T): T[] {
  const i = list.findIndex((x) => x.id === doc.id);
  if (i === -1) return [doc, ...list];
  const copy = list.slice();
  copy[i] = doc;
  return copy;
}

/* ------------------------------------------------------------------ local */

export const LOCAL_KEY = 'paisa-ledger:v1';
export const MIGRATED_KEY = 'paisa-ledger:v1:migrated';

export function readLocal(key = LOCAL_KEY): DataSnapshot | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const s = parsed?.state ?? parsed; // older builds wrapped data in { state, version }
    if (!Array.isArray(s?.transactions) || !Array.isArray(s?.loans)) return null;
    return {
      transactions: s.transactions,
      loans: s.loans.map((l: Loan) => ({ ...l, repayments: l.repayments ?? [] })),
      activity: Array.isArray(s.activity) ? s.activity : [],
      settings: { ...defaultSettings, ...(s.settings ?? {}) },
    };
  } catch {
    return null;
  }
}

export function createLocalBackend(get: () => DataSnapshot, set: (s: DataSnapshot) => void): Backend {
  return {
    mode: 'local',
    async commit(ops) {
      const next = applyOps(get(), ops);
      // Write to storage first; only update the UI when the save succeeded.
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ state: next, version: 2 }));
      set(next);
      return 'saved';
    },
    stop() {},
  };
}
