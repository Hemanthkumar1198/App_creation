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
  entity: 'transaction' | 'loan' | 'repayment' | 'data';
  label: string;
}
