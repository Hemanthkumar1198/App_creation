import { create } from 'zustand';
import type { ActivityEntry, Loan, Repayment, Settings, Transaction } from '../types';
import { buildSampleData } from '../data/sample';
import { round2 } from '../lib/finance';
import { formatINR, uid } from '../lib/format';
import { suggestRepaymentSplit } from '../lib/loans';
import { todayISO } from '../lib/dates';
import { defaultSettings, type Backend, type CommitResult, type DataSnapshot, type Op } from './backend';

export const AUTO_BACKUP_KEY = 'paisa-ledger:auto-backup';
export const THEME_KEY = 'paisa-ledger:theme';

export type TxInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type LoanInput = Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'repayments' | 'closedAt'>;
export type RepaymentInput = Omit<Repayment, 'id' | 'createdAt'>;

export interface BackupFile {
  app: 'paisa-ledger';
  version: 1 | 2;
  exportedAt: string;
  transactions: Transaction[];
  loans: Loan[];
  settings: Settings;
}

export class ValidationError extends Error {}

type Result = Promise<CommitResult>;

interface State extends DataSnapshot {
  /** loading until the active backend delivered its first data */
  status: 'idle' | 'loading' | 'ready';
  mode: 'local' | 'cloud' | null;
  pendingSync: boolean;
  syncError: string | null;

  addTransaction: (input: TxInput) => Promise<{ id: string; result: CommitResult }>;
  updateTransaction: (id: string, input: TxInput) => Result;
  deleteTransaction: (id: string) => Result;
  restoreTransaction: (id: string) => Result;
  purgeTransaction: (id: string) => Result;

  addLoan: (input: LoanInput) => Promise<{ id: string; result: CommitResult }>;
  updateLoan: (id: string, input: Partial<LoanInput>) => Result;
  deleteLoan: (id: string) => Result;
  restoreLoan: (id: string) => Result;
  purgeLoan: (id: string) => Result;
  closeLoan: (id: string, date: string, settlement?: RepaymentInput) => Result;
  reopenLoan: (id: string) => Result;

  addRepayment: (loanId: string, input: RepaymentInput) => Result;
  updateRepayment: (loanId: string, repaymentId: string, input: RepaymentInput) => Result;
  deleteRepayment: (loanId: string, repaymentId: string) => Result;

  updateSettings: (s: Partial<Settings>) => Result;
  importRecords: (txs: Transaction[], loans: Loan[], label: string) => Result;
  replaceAll: (data: { transactions: Transaction[]; loans: Loan[]; settings?: Settings }, label: string) => Result;
  loadSampleData: () => Result;
  clearAllData: () => Result;
  emptyTrash: () => Result;
}

let backend: Backend | null = null;

export function setBackend(b: Backend | null) {
  backend?.stop();
  backend = b;
}

const nowISO = () => new Date().toISOString();
const MAX_AMOUNT = 1e11;

function activity(entry: Omit<ActivityEntry, 'id' | 'at'>): Op {
  return { kind: 'activity', op: 'put', doc: { ...entry, id: uid(), at: nowISO() } };
}

function commit(ops: Op[]): Result {
  if (!backend) return Promise.reject(new Error('Your data is still loading. Please try again in a moment.'));
  return backend.commit(ops);
}

function assertAmount(n: number, label = 'Amount', allowZero = false) {
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) throw new ValidationError(`${label} must be greater than ₹0`);
  if (n > MAX_AMOUNT) throw new ValidationError(`${label} is too large`);
}

function assertDate(d: string, label = 'Date') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new ValidationError(`${label} is not a valid date`);
}

function cleanTx(input: TxInput): TxInput {
  const amount = round2(input.amount);
  assertAmount(amount);
  assertDate(input.date);
  if (input.type !== 'income' && input.type !== 'expense') throw new ValidationError('Choose Cash In or Cash Out');
  if (!input.category) throw new ValidationError('Choose a category');
  return {
    ...input,
    amount,
    description: input.description.trim().slice(0, 200),
    notes: input.notes.trim().slice(0, 1000),
  };
}

function validateLoan(l: Loan) {
  if (!l.borrowerName.trim()) throw new ValidationError("Enter the borrower's name");
  assertAmount(l.principal, 'Principal');
  assertDate(l.startDate, 'Start date');
  assertDate(l.dueDate, 'Due date');
  if (l.dueDate <= l.startDate) throw new ValidationError('Due date must be after the start date');
  if (!Number.isFinite(l.interestRate) || l.interestRate < 0) throw new ValidationError('Interest rate cannot be negative');
  if (l.interestType !== 'fixed' && l.interestRate > 100) throw new ValidationError('Interest rate looks too high (max 100%)');
}

function cleanRepayment(input: RepaymentInput): RepaymentInput {
  const r = {
    ...input,
    amount: round2(input.amount),
    principalPortion: round2(input.principalPortion),
    interestPortion: round2(input.interestPortion),
    notes: input.notes.trim().slice(0, 500),
  };
  assertAmount(r.amount, 'Repayment amount');
  assertDate(r.date, 'Repayment date');
  if (r.principalPortion < 0 || r.interestPortion < 0) throw new ValidationError('Principal and interest portions cannot be negative');
  if (Math.abs(round2(r.principalPortion + r.interestPortion) - r.amount) > 0.009) throw new ValidationError('Principal + interest must equal the repayment amount');
  return r;
}

/** A repayment can never exceed what is outstanding on its date. */
function assertWithinOutstanding(loan: Loan, r: RepaymentInput, excludeId?: string) {
  if (r.date < loan.startDate) throw new ValidationError('Repayment date cannot be before the loan start date');
  const due = suggestRepaymentSplit(loan, r.amount, r.date, excludeId);
  if (r.principalPortion > due.principalDue + 0.009)
    throw new ValidationError(`Principal portion exceeds the remaining principal of ${formatINR(due.principalDue, { paise: true })}`);
  // Interest may be paid in advance (up to 12 months), but never more than that.
  if (r.interestPortion > due.maxInterest + 0.009)
    throw new ValidationError(
      r.principalPortion > 0
        ? `Repayment exceeds the outstanding amount of ${formatINR(due.outstanding, { paise: true })} on that date`
        : `Interest is more than what's due (${formatINR(due.interestDue, { paise: true })}) plus 12 months in advance`,
    );
}

export const useStore = create<State>()((_set, get) => {
  const findTx = (id: string) => {
    const t = get().transactions.find((x) => x.id === id);
    if (!t) throw new ValidationError('Transaction not found');
    return t;
  };
  const findLoan = (id: string) => {
    const l = get().loans.find((x) => x.id === id);
    if (!l) throw new ValidationError('Loan not found');
    return l;
  };
  const putLoan = (l: Loan): Op => ({ kind: 'loan', op: 'put', doc: { ...l, updatedAt: nowISO() } });
  const txLabel = (t: { type: string; amount: number; category: string }) => `${t.type === 'income' ? 'Cash in' : 'Cash out'} ${formatINR(t.amount)} · ${t.category}`;

  return {
    transactions: [],
    loans: [],
    activity: [],
    settings: defaultSettings,
    status: 'idle',
    mode: null,
    pendingSync: false,
    syncError: null,

    addTransaction: async (input) => {
      const clean = cleanTx(input);
      const t: Transaction = { ...clean, id: uid(), createdAt: nowISO(), updatedAt: nowISO() };
      const s = get().settings;
      const ops: Op[] = [{ kind: 'tx', op: 'put', doc: t }, activity({ action: 'created', entity: 'transaction', label: txLabel(t) })];
      if (s.lastPaymentMethod !== t.paymentMethod) ops.push({ kind: 'settings', op: 'put', doc: { ...s, lastPaymentMethod: t.paymentMethod } });
      return { id: t.id, result: await commit(ops) };
    },
    updateTransaction: async (id, input) => {
      const t = { ...findTx(id), ...cleanTx(input), updatedAt: nowISO() };
      return commit([{ kind: 'tx', op: 'put', doc: t }, activity({ action: 'updated', entity: 'transaction', label: `Edited ${txLabel(t)}` })]);
    },
    deleteTransaction: async (id) => {
      const t = findTx(id);
      return commit([{ kind: 'tx', op: 'put', doc: { ...t, deletedAt: nowISO() } }, activity({ action: 'deleted', entity: 'transaction', label: `${txLabel(t)} moved to trash` })]);
    },
    restoreTransaction: async (id) => {
      const { deletedAt: _d, ...t } = findTx(id);
      return commit([{ kind: 'tx', op: 'put', doc: t }, activity({ action: 'restored', entity: 'transaction', label: `Restored ${txLabel(t)}` })]);
    },
    purgeTransaction: async (id) => {
      const t = findTx(id);
      return commit([{ kind: 'tx', op: 'delete', id }, activity({ action: 'purged', entity: 'transaction', label: `Permanently deleted ${txLabel(t)}` })]);
    },

    addLoan: async (input) => {
      const l: Loan = { ...input, borrowerName: input.borrowerName.trim(), principal: round2(input.principal), id: uid(), repayments: [], createdAt: nowISO(), updatedAt: nowISO() };
      validateLoan(l);
      const result = await commit([putLoan(l), activity({ action: 'created', entity: 'loan', label: `Lent ${formatINR(l.principal)} to ${l.borrowerName}` })]);
      return { id: l.id, result };
    },
    updateLoan: async (id, input) => {
      const l: Loan = { ...findLoan(id), ...input };
      if (input.principal !== undefined) l.principal = round2(input.principal);
      validateLoan(l);
      const principalPaid = l.repayments.reduce((a, r) => a + r.principalPortion, 0);
      if (principalPaid > l.principal + 0.009) throw new ValidationError(`Principal cannot be less than the ${formatINR(principalPaid)} already repaid`);
      return commit([putLoan(l), activity({ action: 'updated', entity: 'loan', label: `Edited loan · ${l.borrowerName}` })]);
    },
    deleteLoan: async (id) => {
      const l = findLoan(id);
      return commit([putLoan({ ...l, deletedAt: nowISO() }), activity({ action: 'deleted', entity: 'loan', label: `Loan to ${l.borrowerName} moved to trash` })]);
    },
    restoreLoan: async (id) => {
      const { deletedAt: _d, ...l } = findLoan(id);
      return commit([putLoan(l), activity({ action: 'restored', entity: 'loan', label: `Restored loan to ${l.borrowerName}` })]);
    },
    purgeLoan: async (id) => {
      const l = findLoan(id);
      return commit([{ kind: 'loan', op: 'delete', id }, activity({ action: 'purged', entity: 'loan', label: `Permanently deleted loan to ${l.borrowerName}` })]);
    },
    closeLoan: async (id, date, settlement) => {
      const l = findLoan(id);
      assertDate(date, 'Settlement date');
      if (date < l.startDate) throw new ValidationError('Settlement date cannot be before the loan start date');
      let repayments = l.repayments;
      if (settlement && settlement.amount > 0) {
        const r = cleanRepayment(settlement);
        assertWithinOutstanding(l, r);
        repayments = [...repayments, { ...r, id: uid(), createdAt: nowISO() }];
      }
      return commit([putLoan({ ...l, closedAt: date, repayments }), activity({ action: 'closed', entity: 'loan', label: `Loan to ${l.borrowerName} marked as fully repaid` })]);
    },
    reopenLoan: async (id) => {
      const { closedAt: _c, ...l } = findLoan(id);
      return commit([putLoan(l as Loan), activity({ action: 'updated', entity: 'loan', label: `Reopened loan to ${l.borrowerName}` })]);
    },

    addRepayment: async (loanId, input) => {
      const l = findLoan(loanId);
      const r = cleanRepayment(input);
      assertWithinOutstanding(l, r);
      return commit([
        putLoan({ ...l, repayments: [...l.repayments, { ...r, id: uid(), createdAt: nowISO() }] }),
        activity({ action: 'repayment', entity: 'repayment', label: `Received ${formatINR(r.amount)} from ${l.borrowerName}` }),
      ]);
    },
    updateRepayment: async (loanId, repaymentId, input) => {
      const l = findLoan(loanId);
      const r = cleanRepayment(input);
      assertWithinOutstanding(l, r, repaymentId);
      return commit([
        putLoan({ ...l, repayments: l.repayments.map((x) => (x.id === repaymentId ? { ...x, ...r } : x)) }),
        activity({ action: 'updated', entity: 'repayment', label: `Edited repayment from ${l.borrowerName} · ${formatINR(r.amount)}` }),
      ]);
    },
    deleteRepayment: async (loanId, repaymentId) => {
      const l = findLoan(loanId);
      const r = l.repayments.find((x) => x.id === repaymentId);
      return commit([
        putLoan({ ...l, repayments: l.repayments.filter((x) => x.id !== repaymentId) }),
        activity({ action: 'deleted', entity: 'repayment', label: `Deleted repayment from ${l.borrowerName}${r ? ` · ${formatINR(r.amount)} (${r.date})` : ''}` }),
      ]);
    },

    updateSettings: async (patch) => {
      if (patch.theme) {
        try {
          localStorage.setItem(THEME_KEY, patch.theme);
        } catch {
          /* ignore */
        }
      }
      return commit([{ kind: 'settings', op: 'put', doc: { ...get().settings, ...patch } }]);
    },
    importRecords: async (txs, loans, label) => {
      txs.forEach((t) => cleanTx(t));
      loans.forEach(validateLoan);
      return commit([
        ...txs.map((doc): Op => ({ kind: 'tx', op: 'put', doc })),
        ...loans.map((doc): Op => ({ kind: 'loan', op: 'put', doc })),
        activity({ action: 'imported', entity: 'data', label }),
      ]);
    },
    replaceAll: async (data, label) => {
      const s = get();
      const keepTx = new Set(data.transactions.map((t) => t.id));
      const keepLoan = new Set(data.loans.map((l) => l.id));
      const ops: Op[] = [
        ...s.transactions.filter((t) => !keepTx.has(t.id)).map((t): Op => ({ kind: 'tx', op: 'delete', id: t.id })),
        ...s.loans.filter((l) => !keepLoan.has(l.id)).map((l): Op => ({ kind: 'loan', op: 'delete', id: l.id })),
        ...data.transactions.map((doc): Op => ({ kind: 'tx', op: 'put', doc })),
        ...data.loans.map((doc): Op => ({ kind: 'loan', op: 'put', doc: { ...doc, repayments: doc.repayments ?? [] } })),
      ];
      if (data.settings) ops.push({ kind: 'settings', op: 'put', doc: { ...defaultSettings, ...data.settings, theme: s.settings.theme } });
      ops.push(activity({ action: 'imported', entity: 'data', label }));
      return commit(ops);
    },
    loadSampleData: async () => get().replaceAll(buildSampleData(), 'Loaded sample data'),
    clearAllData: async () => get().replaceAll({ transactions: [], loans: [] }, 'All data erased'),
    emptyTrash: async () => {
      const s = get();
      return commit([
        ...s.transactions.filter((t) => t.deletedAt).map((t): Op => ({ kind: 'tx', op: 'delete', id: t.id })),
        ...s.loans.filter((l) => l.deletedAt).map((l): Op => ({ kind: 'loan', op: 'delete', id: l.id })),
        activity({ action: 'purged', entity: 'data', label: 'Trash emptied' }),
      ]);
    },
  };
});

/** Builds the JSON backup payload from the current state. */
export function makeBackup(): BackupFile {
  const { transactions, loans, settings } = useStore.getState();
  return { app: 'paisa-ledger', version: 2, exportedAt: nowISO(), transactions, loans, settings };
}

export function isBackupFile(x: unknown): x is BackupFile {
  const b = x as BackupFile;
  return !!b && b.app === 'paisa-ledger' && Array.isArray(b.transactions) && Array.isArray(b.loans);
}

/** Device-only mode: keep one rolling snapshot per day as an extra safety net. */
export function runDailyAutoBackup() {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    const prev = raw ? (JSON.parse(raw) as BackupFile) : null;
    if (prev && prev.exportedAt.slice(0, 10) === todayISO()) return;
    const b = makeBackup();
    if (b.transactions.length || b.loans.length) localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function readAutoBackup(): BackupFile | null {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    const b = raw ? JSON.parse(raw) : null;
    return isBackupFile(b) ? b : null;
  } catch {
    return null;
  }
}
