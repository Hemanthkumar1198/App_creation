/**
 * Reusable, pure financial calculation functions.
 * Nothing in the UI hard-codes a financial formula — everything goes through here.
 */
import type { Compounding, InterestMethod, InterestType } from '../types';
import { monthsBetween } from './dates';

/** Round half away from zero to 2 decimal places, avoiding binary float artefacts (1.005 → 1.01). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Number(`${Math.abs(value)}e2`))) / 100;
}

/** Sum a list of money values, rounding once at the end. */
export function sumMoney(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0));
}

/**
 * Simple interest: I = P × R × T / 100
 * @param principal  amount lent
 * @param ratePercent rate per period (e.g. 2 for 2%)
 * @param periods    number of periods the rate applies to (may be fractional)
 */
export function simpleInterest(principal: number, ratePercent: number, periods: number): number {
  if (principal <= 0 || ratePercent <= 0 || periods <= 0) return 0;
  return round2((principal * ratePercent * periods) / 100);
}

/**
 * Compound interest earned (not the final amount): P × ((1 + r/100)^n − 1)
 * @param ratePercent rate per compounding period
 * @param periods     number of compounding periods (may be fractional)
 */
export function compoundInterest(principal: number, ratePercent: number, periods: number): number {
  if (principal <= 0 || ratePercent <= 0 || periods <= 0) return 0;
  return round2(principal * (Math.pow(1 + ratePercent / 100, periods) - 1));
}

/** Simple interest with a monthly rate, for a duration expressed in months. ₹50,000 × 2% × 6 = ₹6,000. */
export function monthlyInterest(principal: number, monthlyRatePercent: number, months: number): number {
  return simpleInterest(principal, monthlyRatePercent, months);
}

/** Simple interest with a yearly rate, for a duration expressed in months (converted to years). */
export function yearlyInterest(principal: number, yearlyRatePercent: number, months: number): number {
  return simpleInterest(principal, yearlyRatePercent, months / 12);
}

export const COMPOUNDING_PER_YEAR: Record<Compounding, number> = {
  monthly: 12,
  quarterly: 4,
  'half-yearly': 2,
  yearly: 1,
};

export interface InterestTerms {
  interestType: InterestType;
  /** % per month, % per year, or ₹ amount for 'fixed'. */
  interestRate: number;
  interestMethod: InterestMethod;
  compounding: Compounding;
}

/** Annual nominal rate (%) implied by the terms. Monthly 2% → 24% p.a. */
export function annualRate(terms: InterestTerms): number {
  if (terms.interestType === 'monthly') return terms.interestRate * 12;
  if (terms.interestType === 'yearly') return terms.interestRate;
  return 0;
}

/**
 * Growth multiplier minus one for `months` of compound growth, i.e. ((1+i)^n − 1)
 * where i is the rate per compounding period and n the number of compounding periods.
 */
export function compoundFactor(terms: InterestTerms, months: number): number {
  if (months <= 0) return 0;
  const perYear = COMPOUNDING_PER_YEAR[terms.compounding];
  const i = annualRate(terms) / perYear / 100;
  const n = (months * perYear) / 12;
  return Math.pow(1 + i, n) - 1;
}

/**
 * Interest on a constant balance for `months` under the given terms (unrounded).
 * Fixed-amount loans are handled at loan level, so this returns 0 for them.
 */
export function interestForMonthsRaw(balance: number, terms: InterestTerms, months: number): number {
  if (balance <= 0 || months <= 0 || terms.interestType === 'fixed') return 0;
  if (terms.interestMethod === 'compound') return balance * compoundFactor(terms, months);
  const ratePerMonth = terms.interestType === 'monthly' ? terms.interestRate : terms.interestRate / 12;
  return (balance * ratePerMonth * months) / 100;
}

/** Interest on a constant balance for `months` under the given terms, rounded to paise. */
export function interestForMonths(balance: number, terms: InterestTerms, months: number): number {
  return round2(interestForMonthsRaw(balance, terms, months));
}

/** Interest on a principal between two dates using actual elapsed calendar time. */
export function interestBetween(principal: number, terms: InterestTerms, start: string, end: string): number {
  if (terms.interestType === 'fixed') return end >= start ? round2(terms.interestRate) : 0;
  return interestForMonths(principal, terms, monthsBetween(start, end));
}

/** Total repayment = principal + interest. */
export function totalRepayment(principal: number, interest: number): number {
  return round2(principal + interest);
}

/** Outstanding principal after principal repayments (never negative). */
export function outstandingPrincipal(principal: number, principalRepaid: number): number {
  return round2(Math.max(0, principal - principalRepaid));
}

/** Outstanding interest = accrued − paid (never negative). */
export function outstandingInterest(interestAccrued: number, interestPaid: number): number {
  return round2(Math.max(0, interestAccrued - interestPaid));
}

/** Remaining balance = outstanding principal + outstanding interest. */
export function remainingBalance(principalOutstanding: number, interestOutstanding: number): number {
  return round2(Math.max(0, principalOutstanding) + Math.max(0, interestOutstanding));
}

/**
 * Split a repayment into interest and principal portions: interest first
 * (up to what is outstanding), then principal.
 */
export function splitRepayment(
  amount: number,
  interestDue: number,
): { interestPortion: number; principalPortion: number } {
  const amt = round2(Math.max(0, amount));
  const interestPortion = round2(Math.min(amt, Math.max(0, interestDue)));
  return { interestPortion, principalPortion: round2(amt - interestPortion) };
}

/** Percentage helper, safe against divide-by-zero. */
export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return round2((part / whole) * 100);
}
