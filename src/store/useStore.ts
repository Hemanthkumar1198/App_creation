import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ActivityEntry, Loan, Repayment, Settings, Transaction } from '../types';
import { buildSampleData } from '../data/sample';
import { round2 } from '../lib/finance';
import { formatINR, uid } from '../lib/format';
import { todayISO } from '../lib/dates';

export const STORAGE_KEY = 'paisa-ledger:v1';
export const AUTO_BACKUP_KEY = 'paisa-ledger:auto-backup';

export type TxInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type LoanInput = Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'repayments' | 'closedAt'>;
export type RepaymentInput = Omit<Repayment, 'id' | 'createdAt'>;

export interface BackupFile {
  app: 'paisa-ledger';
  version: 1;
  exportedAt: string;
  transactions: Transaction[];
  loans: Loan[];
  settings: Settings;
}

interface State {
  transactions: Transaction[];
  loans: Loan[];
  settings: Settings;
  activity: ActivityEntry[];

  addTransaction: (input: TxInput) => Transaction;
  updateTransaction: (id: string, input: Partial<TxInput>) => void;
  deleteTransaction: (id: string) => void;
  restoreTransaction: (id: string) => void;
  purgeTransaction: (id: string) => void;

  addLoan: (input: LoanInput) => Loan;
  updateLoan: (id: string, input: Partial<LoanInput>) => void;
  deleteLoan: (id: string) => void;
  restoreLoan: (id: string) => void;
  purgeLoan: (id: string) => void;
  closeLoan: (id: string, date: string, settlement?: RepaymentInput) => void;
  reopenLoan: (id: string) => void;

  addRepayment: (loanId: string, input: RepaymentInput) => void;
  updateRepayment: (loanId: string, repaymentId: string, input: RepaymentInput) => void;
  deleteRepayment: (loanId: string, repaymentId: string) => void;

  updateSettings: (s: Partial<Settings>) => void;
  importBackup: (b: BackupFile) => void;
  loadSampleData: () => void;
  clearAllData: () => void;
  emptyTrash: () => void;
}

const defaultSettings: Settings = {
  theme: 'system',
  userName: '',
  reminderDays: 7,
  browserNotifications: false,
  lastPaymentMethod: 'UPI',
};

const nowISO = () => new Date().toISOString();

function log(activity: ActivityEntry[], entry: Omit<ActivityEntry, 'id' | 'at'>): ActivityEntry[] {
  return [{ ...entry, id: uid(), at: nowISO() }, ...activity].slice(0, 500);
}

function cleanTx(input: Partial<TxInput>): Partial<TxInput> {
  return input.amount !== undefined ? { ...input, amount: round2(input.amount) } : input;
}

function cleanRepayment(input: RepaymentInput): RepaymentInput {
  return {
    ...input,
    amount: round2(input.amount),
    principalPortion: round2(input.principalPortion),
    interestPortion: round2(input.interestPortion),
  };
}

const sample = buildSampleData();

export const useStore = create<State>()(
  persist(
    (set) => ({
      transactions: sample.transactions,
      loans: sample.loans,
      settings: defaultSettings,
      activity: [],

      addTransaction: (input) => {
        const t: Transaction = { ...(cleanTx(input) as TxInput), id: uid(), createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({
          transactions: [t, ...s.transactions],
          settings: { ...s.settings, lastPaymentMethod: input.paymentMethod },
          activity: log(s.activity, { action: 'created', entity: 'transaction', label: `${t.type === 'income' ? 'Cash in' : 'Cash out'} ${formatINR(t.amount)} · ${t.category}` }),
        }));
        return t;
      },
      updateTransaction: (id, input) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...cleanTx(input), updatedAt: nowISO() } : t)),
          activity: log(s.activity, { action: 'updated', entity: 'transaction', label: `Edited ${input.category ?? 'transaction'} ${input.amount !== undefined ? formatINR(input.amount) : ''}`.trim() }),
        })),
      deleteTransaction: (id) =>
        set((s) => {
          const t = s.transactions.find((x) => x.id === id);
          return {
            transactions: s.transactions.map((x) => (x.id === id ? { ...x, deletedAt: nowISO() } : x)),
            activity: t ? log(s.activity, { action: 'deleted', entity: 'transaction', label: `${t.category} ${formatINR(t.amount)} moved to trash` }) : s.activity,
          };
        }),
      restoreTransaction: (id) =>
        set((s) => ({
          transactions: s.transactions.map((x) => (x.id === id ? { ...x, deletedAt: undefined } : x)),
          activity: log(s.activity, { action: 'restored', entity: 'transaction', label: 'Transaction restored' }),
        })),
      purgeTransaction: (id) =>
        set((s) => ({
          transactions: s.transactions.filter((x) => x.id !== id),
          activity: log(s.activity, { action: 'purged', entity: 'transaction', label: 'Transaction permanently deleted' }),
        })),

      addLoan: (input) => {
        const l: Loan = { ...input, principal: round2(input.principal), id: uid(), repayments: [], createdAt: nowISO(), updatedAt: nowISO() };
        set((s) => ({ loans: [l, ...s.loans], activity: log(s.activity, { action: 'created', entity: 'loan', label: `Lent ${formatINR(l.principal)} to ${l.borrowerName}` }) }));
        return l;
      },
      updateLoan: (id, input) =>
        set((s) => ({
          loans: s.loans.map((l) => (l.id === id ? { ...l, ...input, updatedAt: nowISO() } : l)),
          activity: log(s.activity, { action: 'updated', entity: 'loan', label: `Edited loan${input.borrowerName ? ` · ${input.borrowerName}` : ''}` }),
        })),
      deleteLoan: (id) =>
        set((s) => {
          const l = s.loans.find((x) => x.id === id);
          return {
            loans: s.loans.map((x) => (x.id === id ? { ...x, deletedAt: nowISO() } : x)),
            activity: l ? log(s.activity, { action: 'deleted', entity: 'loan', label: `Loan to ${l.borrowerName} moved to trash` }) : s.activity,
          };
        }),
      restoreLoan: (id) =>
        set((s) => ({ loans: s.loans.map((x) => (x.id === id ? { ...x, deletedAt: undefined } : x)), activity: log(s.activity, { action: 'restored', entity: 'loan', label: 'Loan restored' }) })),
      purgeLoan: (id) =>
        set((s) => ({ loans: s.loans.filter((x) => x.id !== id), activity: log(s.activity, { action: 'purged', entity: 'loan', label: 'Loan permanently deleted' }) })),
      closeLoan: (id, date, settlement) =>
        set((s) => ({
          loans: s.loans.map((l) =>
            l.id === id
              ? {
                  ...l,
                  closedAt: date,
                  updatedAt: nowISO(),
                  repayments: settlement && settlement.amount > 0 ? [...l.repayments, { ...cleanRepayment(settlement), id: uid(), createdAt: nowISO() }] : l.repayments,
                }
              : l,
          ),
          activity: log(s.activity, { action: 'closed', entity: 'loan', label: `Loan to ${s.loans.find((l) => l.id === id)?.borrowerName ?? ''} marked as paid` }),
        })),
      reopenLoan: (id) =>
        set((s) => ({ loans: s.loans.map((l) => (l.id === id ? { ...l, closedAt: undefined, updatedAt: nowISO() } : l)), activity: log(s.activity, { action: 'updated', entity: 'loan', label: 'Loan reopened' }) })),

      addRepayment: (loanId, input) =>
        set((s) => {
          const l = s.loans.find((x) => x.id === loanId);
          return {
            loans: s.loans.map((x) => (x.id === loanId ? { ...x, updatedAt: nowISO(), repayments: [...x.repayments, { ...cleanRepayment(input), id: uid(), createdAt: nowISO() }] } : x)),
            activity: log(s.activity, { action: 'repayment', entity: 'repayment', label: `Received ${formatINR(input.amount)} from ${l?.borrowerName ?? 'borrower'}` }),
          };
        }),
      updateRepayment: (loanId, repaymentId, input) =>
        set((s) => ({
          loans: s.loans.map((x) =>
            x.id === loanId ? { ...x, updatedAt: nowISO(), repayments: x.repayments.map((r) => (r.id === repaymentId ? { ...r, ...cleanRepayment(input) } : r)) } : x,
          ),
          activity: log(s.activity, { action: 'updated', entity: 'repayment', label: `Edited repayment ${formatINR(input.amount)}` }),
        })),
      deleteRepayment: (loanId, repaymentId) =>
        set((s) => {
          const r = s.loans.find((x) => x.id === loanId)?.repayments.find((y) => y.id === repaymentId);
          return {
            loans: s.loans.map((x) => (x.id === loanId ? { ...x, updatedAt: nowISO(), repayments: x.repayments.filter((y) => y.id !== repaymentId) } : x)),
            activity: log(s.activity, { action: 'deleted', entity: 'repayment', label: `Deleted repayment ${r ? formatINR(r.amount) : ''} dated ${r?.date ?? ''}` }),
          };
        }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      importBackup: (b) =>
        set((s) => ({
          transactions: b.transactions,
          loans: b.loans,
          settings: { ...defaultSettings, ...b.settings },
          activity: log(s.activity, { action: 'imported', entity: 'data', label: `Restored backup from ${b.exportedAt.slice(0, 10)}` }),
        })),
      loadSampleData: () => {
        const fresh = buildSampleData();
        set((s) => ({ ...fresh, activity: log(s.activity, { action: 'imported', entity: 'data', label: 'Loaded sample data' }) }));
      },
      clearAllData: () => set((s) => ({ transactions: [], loans: [], activity: log(s.activity, { action: 'purged', entity: 'data', label: 'All data cleared' }) })),
      emptyTrash: () =>
        set((s) => ({
          transactions: s.transactions.filter((t) => !t.deletedAt),
          loans: s.loans.filter((l) => !l.deletedAt),
          activity: log(s.activity, { action: 'purged', entity: 'data', label: 'Trash emptied' }),
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Builds the JSON backup payload from the current state. */
export function makeBackup(): BackupFile {
  const { transactions, loans, settings } = useStore.getState();
  return { app: 'paisa-ledger', version: 1, exportedAt: nowISO(), transactions, loans, settings };
}

export function isBackupFile(x: unknown): x is BackupFile {
  const b = x as BackupFile;
  return !!b && b.app === 'paisa-ledger' && Array.isArray(b.transactions) && Array.isArray(b.loans);
}

/** Keeps one rolling local snapshot per day as an extra safety net against accidental changes. */
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

/* Convenience selectors */
export const useTransactions = () => useStore((s) => s.transactions);
export const useLoans = () => useStore((s) => s.loans);
