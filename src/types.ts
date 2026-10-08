export type TxType = 'income' | 'expense';

export type PaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'Bank Transfer'
  | 'Debit Card'
  | 'Credit Card'
  | 'Cheque'
  | 'Other';

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  /** ISO date, YYYY-MM-DD (local) */
  date: string;
  category: string;
  description: string;
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
  updatedAt: string;
  /** Soft-delete marker — deleted items live in the trash until purged. */
  deletedAt?: string;
}

/** How the interest rate is expressed. */
export type InterestType = 'monthly' | 'yearly' | 'fixed';
/** Simple or compound interest. */
export type InterestMethod = 'simple' | 'compound';
export type Compounding = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
export type PaymentFrequency = 'one-time' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';

export interface Repayment {
  id: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  principalPortion: number;
  interestPortion: number;
  notes: string;
  createdAt: string;
  /**
   * Interest received settles all interest up to this date: interest starts fresh from it.
   * When unset, an interest-only receipt settles; a payment that includes principal does not.
   */
  settlesInterest?: boolean;
}

export interface Loan {
  id: string;
  borrowerName: string;
  phone: string;
  principal: number;
  startDate: string;
  /** % per month / % per year, or a ₹ amount when interestType is 'fixed'. */
  interestRate: number;
  interestType: InterestType;
  interestMethod: InterestMethod;
  compounding: Compounding;
  dueDate: string;
  durationMonths: number;
  paymentFrequency: PaymentFrequency;
  notes: string;
  /** Optional manual "Interest Calculation End Date". Defaults to today. */
  interestEndDate?: string;
  /** Set when the loan is marked as paid / closed. */
  closedAt?: string;
  repayments: Repayment[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type LoanStatus = 'active' | 'partially-paid' | 'fully-paid' | 'overdue';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  theme: ThemeMode;
  userName: string;
  reminderDays: number;
  browserNotifications: boolean;
  lastPaymentMethod: PaymentMethod;
}

export interface ActivityEntry {
  id: string;
  at: string;
  action: 'created' | 'updated' | 'deleted' | 'restored' | 'purged' | 'imported' | 'repayment' | 'closed';
  entity: 'transaction' | 'loan' | 'repayment' | 'data' | 'note' | 'plan';
  label: string;
}

/** Snapshot of a record taken just before it was changed — kept forever (append-only). */
export interface HistoryEntry {
  id: string;
  at: string;
  entity: 'transaction' | 'loan' | 'note' | 'plan';
  docId: string;
  before: Transaction | Loan | CalcNote | Plan;
}

/* ---------------------------------------------------------- Calculation notes */

/** One line in a separate calculation (e.g. "Paddy harvest" — labour ₹4,000). */
export interface NoteEntry {
  id: string;
  date: string;
  /** 'out' = money spent, 'in' = money received (e.g. paddy sale). */
  type: 'out' | 'in';
  amount: number;
  description: string;
  notes: string;
  createdAt: string;
}

/** A separate calculation book, kept apart from daily expenses. */
export interface CalcNote {
  id: string;
  name: string;
  description: string;
  entries: NoteEntry[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/* ---------------------------------------------------- Investments & insurance */

export type PlanKind = 'SIP' | 'Mutual Fund' | 'LIC' | 'Term Insurance' | 'Health Insurance' | 'Vehicle Insurance' | 'PPF' | 'FD / RD' | 'Gold' | 'Other';
export type PlanFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'one-time';

export interface PlanPayment {
  id: string;
  date: string;
  amount: number;
  /** What this entry was for (optional), e.g. "SIP October", "Premium 2026". */
  description?: string;
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
}

/** A recurring investment or insurance policy (SIP, LIC, term plan…) and its payments. */
export interface Plan {
  id: string;
  name: string;
  /** SIP, LIC, Term Insurance… or any custom type you type. */
  kind: string;
  provider: string;
  policyNumber: string;
  /** Regular instalment / premium amount; 0 = no fixed amount (free-form record). */
  amount: number;
  frequency: PlanFrequency;
  startDate: string;
  endDate?: string;
  /** Sum assured / cover / target amount (optional). */
  coverAmount?: number;
  notes: string;
  payments: PlanPayment[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
