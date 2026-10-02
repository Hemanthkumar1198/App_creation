/**
 * Storage backends. All writes go through `commit(ops)`:
 *  - cloud: one atomic Firestore batch per user action (offline-queued, synced later)
 *  - local: device storage (used only when cloud sync is not configured)
 * Document IDs are generated on the client, so retrying a write can never create a duplicate.
 */
import type { ActivityEntry, CalcNote, HistoryEntry, Loan, Plan, Settings, Transaction } from '../types';

export type Op =
  | { kind: 'tx'; op: 'put'; doc: Transaction }
  | { kind: 'loan'; op: 'put'; doc: Loan }
  | { kind: 'activity'; op: 'put'; doc: ActivityEntry }
  | { kind: 'settings'; op: 'put'; doc: Settings }
  | { kind: 'history'; op: 'put'; doc: HistoryEntry }
  | { kind: 'note'; op: 'put'; doc: CalcNote }
  | { kind: 'plan'; op: 'put'; doc: Plan };
// Note: there is intentionally no "delete" operation. Records are only ever soft-deleted
// (moved to Trash), and every change keeps the previous version in the history log.

/** 'saved' = durably stored (server ack or device storage); 'queued' = stored offline, will sync. */
export type CommitResult = 'saved' | 'queued';

export interface DataSnapshot {
  transactions: Transaction[];
  loans: Loan[];
  notes: CalcNote[];
  plans: Plan[];
  activity: ActivityEntry[];
  settings: Settings;
  /** Device-only mode keeps version history locally; in the cloud it lives in users/{uid}/history. */
  history?: HistoryEntry[];
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
  let { transactions, loans, notes, plans, activity, settings } = state;
  let history = state.history ?? [];
  for (const o of ops) {
    if (o.kind === 'settings') settings = o.doc;
    else if (o.kind === 'tx') transactions = upsert(transactions, o.doc);
    else if (o.kind === 'loan') loans = upsert(loans, o.doc);
    else if (o.kind === 'note') notes = upsert(notes, o.doc);
    else if (o.kind === 'plan') plans = upsert(plans, o.doc);
    else if (o.kind === 'history') history = [o.doc, ...history].slice(0, 2000);
    else activity = [o.doc, ...activity.filter((a) => a.id !== o.doc.id)].slice(0, 500);
  }
  return { transactions, loans, notes, plans, activity, settings, history };
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
      notes: Array.isArray(s.notes) ? s.notes : [],
      plans: Array.isArray(s.plans) ? s.plans : [],
      activity: Array.isArray(s.activity) ? s.activity : [],
      settings: { ...defaultSettings, ...(s.settings ?? {}) },
      history: Array.isArray(s.history) ? s.history : [],
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
