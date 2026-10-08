/**
 * Loan engine — derives every loan figure from the loan terms, the repayment
 * history and a reference date. Pure: no React, no storage.
 */
import type { Loan, LoanStatus, PaymentFrequency, Repayment } from '../types';
import { addMonths, diffDays, minDate, monthsBetween, todayISO } from './dates';
import {
  interestBetween,
  interestForMonthsRaw,
  outstandingInterest,
  outstandingPrincipal,
  remainingBalance,
  round2,
  splitRepayment,
  sumMoney,
  totalRepayment,
  type InterestTerms,
} from './finance';

export interface TimelineRow {
  id: string;
  date: string;
  amount: number;
  principal: number;
  interest: number;
  /** Interest accrued (cumulative) up to this repayment. */
  interestAccruedToDate: number;
  /** Outstanding (principal + unpaid interest) right after this repayment. */
  balance: number;
  paymentMethod: Repayment['paymentMethod'];
  notes: string;
}

export interface InterestPayment {
  id: string;
  date: string;
  amount: number;
  /** Marked as received without an amount. */
  amountUnknown: boolean;
  /** Cleared all interest up to its date (fresh interest from then). */
  fullSettlement: boolean;
  /** Interest period this payment follows on from (previous interest payment or loan start). */
  periodFrom: string;
  paymentMethod: Repayment['paymentMethod'];
  notes: string;
}

export interface LoanSummary {
  principal: number;
  /** Every payment that included interest, oldest first. */
  interestPayments: InterestPayment[];
  lastInterestPayment: InterestPayment | null;
  /** When the next interest instalment is expected (last interest payment + one interest period). */
  nextInterestDueDate: string | null;
  /** Interest for one period (month by default) on the current remaining principal. */
  interestPerPeriod: number;
  /** Months in one interest period (payment frequency, monthly for one-time loans). */
  interestPeriodMonths: number;
  /** Interest for the full agreed term (start → due date). */
  expectedInterest: number;
  /** Principal + expected interest. */
  totalAmountDue: number;
  /** Interest accrued from start until accrualEndDate on the actual outstanding balance. */
  interestAccrued: number;
  accrualEndDate: string;
  /** True when the end date was chosen manually by the user. */
  manualEndDate: boolean;
  elapsedMonths: number;
  amountRepaid: number;
  principalRepaid: number;
  interestRepaid: number;
  remainingPrincipal: number;
  remainingInterest: number;
  totalOutstanding: number;
  /** Outstanding waived when a loan was marked paid without a settlement payment. */
  writtenOff: number;
  nextDueDate: string | null;
  installmentMissed: boolean;
  suggestedInstallment: number;
  installments: number;
  status: LoanStatus;
  dueSoon: boolean;
  daysToDue: number;
  progress: number;
  timeline: TimelineRow[];
}

export const FREQUENCY_MONTHS: Record<PaymentFrequency, number> = {
  'one-time': 0,
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
};

export function loanTerms(loan: Pick<Loan, 'interestType' | 'interestRate' | 'interestMethod' | 'compounding'>): InterestTerms {
  return {
    interestType: loan.interestType,
    interestRate: loan.interestRate,
    interestMethod: loan.interestMethod,
    compounding: loan.compounding,
  };
}

export function sortRepayments(reps: Repayment[]): Repayment[] {
  return [...reps].sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
}

/** Interest for the agreed term, ignoring repayments. ₹50,000 @ 2%/m for 6m → ₹6,000. */
export function expectedInterest(loan: Loan): number {
  if (loan.interestType === 'fixed') return round2(loan.interestRate);
  return interestBetween(loan.principal, loanTerms(loan), loan.startDate, loan.dueDate);
}

export function installmentCount(loan: Loan): number {
  const step = FREQUENCY_MONTHS[loan.paymentFrequency];
  if (!step) return 1;
  const months = Math.max(1, Math.round(monthsBetween(loan.startDate, loan.dueDate)));
  return Math.max(1, Math.ceil(months / step));
}

export function installmentDates(loan: Loan): string[] {
  const step = FREQUENCY_MONTHS[loan.paymentFrequency];
  if (!step) return [loan.dueDate];
  const dates: string[] = [];
  for (let k = 1; k <= 600; k++) {
    const d = addMonths(loan.startDate, k * step);
    if (d >= loan.dueDate) break;
    dates.push(d);
  }
  dates.push(loan.dueDate);
  return dates;
}

/** The record's description for lists, without the note older imports added about the due date. */
export function loanDescription(loan: Loan): string {
  return loan.notes.replace(/\s*(·\s*)?Due date not in file: set to \d+ months after lending\.?/g, '').trim();
}

/** Interest marked as received without knowing the amount (interest restarts from its date). */
export function isUnknownInterest(r: Repayment): boolean {
  return r.amount === 0 && r.settlesInterest === true;
}

/** Whether a receipt clears all interest up to its date (see Repayment.settlesInterest). */
export function settlesInterest(r: Repayment): boolean {
  return r.settlesInterest ?? (r.principalPortion <= 0 && r.interestPortion > 0);
}

/**
 * Compute the full loan picture as of `asOf` (default: today).
 *
 * Interest accrues on the *actual* outstanding balance over each period between
 * repayments: for simple interest on remaining principal, for compound interest on
 * remaining principal + unpaid interest. Accrual stops at the manual "Interest
 * Calculation End Date", the close date, or `asOf` — whichever is earliest.
 */
export function computeLoan(loan: Loan, asOf: string = todayISO()): LoanSummary {
  const terms = loanTerms(loan);
  const start = loan.startDate;
  const endCandidate = loan.interestEndDate || loan.closedAt || asOf;
  const accrualEnd = minDate(endCandidate, asOf) < start ? start : minDate(endCandidate, asOf);

  const reps = sortRepayments(loan.repayments.filter((r) => r.date <= asOf));
  const elapsed = (d: string) => monthsBetween(start, d < start ? start : d);

  let principalPaid = 0;
  let interestPaid = 0;
  let accrued = 0; // unrounded running total
  let cursor = start;
  const timeline: TimelineRow[] = [];

  const accrue = (to: string) => {
    if (loan.interestType === 'fixed') return;
    const target = to > accrualEnd ? accrualEnd : to;
    if (target <= cursor) return;
    const pOut = Math.max(0, loan.principal - principalPaid);
    const base = loan.interestMethod === 'compound' ? pOut + Math.max(0, accrued - interestPaid) : pOut;
    const months = elapsed(target) - elapsed(cursor);
    // Compound: the base already carries unpaid interest, so chaining segments compounds exactly.
    accrued += interestForMonthsRaw(base, terms, months);
    cursor = target;
  };

  if (loan.interestType === 'fixed' && accrualEnd >= start && asOf >= start) {
    accrued = loan.interestRate;
  }

  for (const r of reps) {
    accrue(r.date);
    principalPaid += r.principalPortion;
    interestPaid += r.interestPortion;
    // "Full interest till this date received": nothing more (or less) is owed up to this date,
    // so interest starts fresh from here on the remaining principal.
    if (loan.interestType !== 'fixed' && settlesInterest(r)) accrued = interestPaid;
    const pOut = outstandingPrincipal(loan.principal, principalPaid);
    const iOut = outstandingInterest(accrued, interestPaid);
    timeline.push({
      id: r.id,
      date: r.date,
      amount: round2(r.amount),
      principal: round2(r.principalPortion),
      interest: round2(r.interestPortion),
      interestAccruedToDate: round2(accrued),
      balance: remainingBalance(pOut, iOut),
      paymentMethod: r.paymentMethod,
      notes: r.notes,
    });
  }
  accrue(accrualEnd);

  const interestAccrued = round2(accrued);
  const principalRepaid = sumMoney(reps.map((r) => r.principalPortion));
  const interestRepaid = sumMoney(reps.map((r) => r.interestPortion));
  const amountRepaid = sumMoney(reps.map((r) => r.amount));
  let remainingPrincipal = outstandingPrincipal(loan.principal, principalRepaid);
  let remainingInterest = outstandingInterest(interestAccrued, interestRepaid);
  let totalOutstanding = remainingBalance(remainingPrincipal, remainingInterest);

  const closed = !!loan.closedAt && loan.closedAt <= asOf;
  let writtenOff = 0;
  if (closed) {
    writtenOff = totalOutstanding;
    remainingPrincipal = 0;
    remainingInterest = 0;
    totalOutstanding = 0;
  }

  const expInterest = expectedInterest(loan);
  const totalAmountDue = totalRepayment(loan.principal, expInterest);
  const fullyPaid = closed || (totalOutstanding <= 0.009 && amountRepaid > 0);

  let status: LoanStatus;
  if (fullyPaid) status = 'fully-paid';
  else if (asOf > loan.dueDate) status = 'overdue';
  else if (amountRepaid > 0) status = 'partially-paid';
  else status = 'active';

  // Next due date / missed instalment detection.
  let nextDueDate: string | null = null;
  let installmentMissed = false;
  if (!fullyPaid) {
    const dates = installmentDates(loan);
    if (asOf > loan.dueDate) {
      nextDueDate = loan.dueDate;
    } else {
      const upcomingIdx = dates.findIndex((d) => d >= asOf);
      const prev = upcomingIdx > 0 ? dates[upcomingIdx - 1] : null;
      if (prev) {
        const windowStart = upcomingIdx > 1 ? dates[upcomingIdx - 2] : start;
        // A past instalment with no repayment since the one before it is still pending.
        if (!reps.some((r) => r.date > windowStart)) {
          nextDueDate = prev;
          installmentMissed = true;
        }
      }
      if (!nextDueDate) nextDueDate = dates[upcomingIdx] ?? loan.dueDate;
    }
  }

  const installments = installmentCount(loan);
  const daysToDue = diffDays(asOf, nextDueDate ?? loan.dueDate);
  const dueSoon = !fullyPaid && status !== 'overdue' && daysToDue >= 0 && daysToDue <= 7;

  // Interest-receipt tracking: each received interest amount starts the next interest period.
  const periodMonths = FREQUENCY_MONTHS[loan.paymentFrequency] || 1;
  const interestPayments: InterestPayment[] = [];
  let prevInterestDate = start;
  for (const r of reps) {
    if (r.interestPortion <= 0 && !isUnknownInterest(r)) continue;
    interestPayments.push({
      id: r.id,
      date: r.date,
      amount: round2(r.interestPortion),
      amountUnknown: isUnknownInterest(r),
      fullSettlement: loan.interestType !== 'fixed' && settlesInterest(r),
      periodFrom: prevInterestDate,
      paymentMethod: r.paymentMethod,
      notes: r.notes,
    });
    prevInterestDate = r.date;
  }
  const lastInterestPayment = interestPayments.length ? interestPayments[interestPayments.length - 1] : null;
  const nextInterestDueDate =
    fullyPaid || loan.interestType === 'fixed' ? null : addMonths(lastInterestPayment?.date ?? start, periodMonths);
  const interestPerPeriod = loan.interestType === 'fixed' ? 0 : round2(interestForMonthsRaw(remainingPrincipal, terms, periodMonths));

  return {
    principal: round2(loan.principal),
    interestPayments,
    lastInterestPayment,
    nextInterestDueDate,
    interestPerPeriod,
    interestPeriodMonths: periodMonths,
    expectedInterest: expInterest,
    totalAmountDue,
    interestAccrued,
    accrualEndDate: accrualEnd,
    manualEndDate: !!loan.interestEndDate,
    elapsedMonths: round2(monthsBetween(start, accrualEnd)),
    amountRepaid,
    principalRepaid,
    interestRepaid,
    remainingPrincipal,
    remainingInterest,
    totalOutstanding,
    writtenOff,
    nextDueDate,
    installmentMissed,
    suggestedInstallment: round2(totalAmountDue / installments),
    installments,
    status,
    dueSoon,
    daysToDue,
    progress: amountRepaid + totalOutstanding > 0 ? Math.min(100, (amountRepaid / (amountRepaid + totalOutstanding)) * 100) : 100,
    timeline,
  };
}

/**
 * Suggested principal/interest split for a new (or edited) repayment:
 * pays outstanding interest as of the repayment date first, then principal.
 */
export function suggestRepaymentSplit(loan: Loan, amount: number, date: string, excludeRepaymentId?: string) {
  const others = { ...loan, closedAt: undefined, repayments: loan.repayments.filter((r) => r.id !== excludeRepaymentId) };
  const s = computeLoan(others, date);
  // Interest may be received in advance, up to 12 months ahead on the remaining principal.
  const advanceInterestAllowed = loan.interestType === 'fixed' ? 0 : round2(interestForMonthsRaw(s.remainingPrincipal, loanTerms(loan), 12));
  return {
    ...splitRepayment(amount, s.remainingInterest),
    interestDue: s.remainingInterest,
    principalDue: s.remainingPrincipal,
    outstanding: s.totalOutstanding,
    maxInterest: round2(s.remainingInterest + advanceInterestAllowed),
  };
}

export interface PortfolioSummary {
  totalLent: number;
  totalRepaid: number;
  principalRepaid: number;
  interestEarned: number;
  interestPending: number;
  interestAccrued: number;
  outstanding: number;
  outstandingPrincipal: number;
  expectedInterest: number;
  counts: Record<LoanStatus, number> & { dueSoon: number; total: number };
}

export function portfolio(loans: Loan[], asOf: string = todayISO()): PortfolioSummary {
  const live = loans.filter((l) => !l.deletedAt && l.startDate <= asOf);
  const sums = live.map((l) => ({ loan: l, s: computeLoan(l, asOf) }));
  const counts = { active: 0, 'partially-paid': 0, 'fully-paid': 0, overdue: 0, dueSoon: 0, total: live.length };
  for (const { s } of sums) {
    counts[s.status]++;
    if (s.dueSoon) counts.dueSoon++;
  }
  return {
    totalLent: sumMoney(sums.map(({ s }) => s.principal)),
    totalRepaid: sumMoney(sums.map(({ s }) => s.amountRepaid)),
    principalRepaid: sumMoney(sums.map(({ s }) => s.principalRepaid)),
    interestEarned: sumMoney(sums.map(({ s }) => s.interestRepaid)),
    interestPending: sumMoney(sums.map(({ s }) => s.remainingInterest)),
    interestAccrued: sumMoney(sums.map(({ s }) => s.interestAccrued)),
    outstanding: sumMoney(sums.map(({ s }) => s.totalOutstanding)),
    outstandingPrincipal: sumMoney(sums.map(({ s }) => s.remainingPrincipal)),
    expectedInterest: sumMoney(sums.map(({ s }) => s.expectedInterest)),
    counts,
  };
}

export const STATUS_LABEL: Record<LoanStatus, string> = {
  active: 'Active',
  'partially-paid': 'Partially Paid',
  'fully-paid': 'Fully Repaid',
  overdue: 'Overdue',
};

export function describeRate(loan: Pick<Loan, 'interestType' | 'interestRate' | 'interestMethod' | 'compounding'>): string {
  if (loan.interestType === 'fixed') return `Fixed ₹${loan.interestRate.toLocaleString('en-IN')}`;
  const unit = loan.interestType === 'monthly' ? 'month' : 'year';
  const method = loan.interestMethod === 'compound' ? `compound ${loan.compounding}` : 'simple';
  return `${loan.interestRate}% / ${unit} · ${method}`;
}
