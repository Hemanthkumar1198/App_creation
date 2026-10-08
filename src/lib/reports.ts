import type { Loan, Transaction, TxType } from '../types';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfYear,
  formatDate,
  formatDateShort,
  formatMonth,
  formatMonthShort,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from './dates';
import { round2, sumMoney } from './finance';
import { portfolio } from './loans';

export type PeriodKind = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Period {
  kind: PeriodKind;
  start: string;
  end: string;
  label: string;
  short: string;
}

export function periodFor(kind: PeriodKind, anchor: string): Period {
  switch (kind) {
    case 'daily':
      return { kind, start: anchor, end: anchor, label: formatDate(anchor), short: formatDateShort(anchor) };
    case 'weekly': {
      const start = startOfWeek(anchor);
      const end = addDays(start, 6);
      return { kind, start, end, label: `${formatDateShort(start)} – ${formatDate(end)}`, short: formatDateShort(start) };
    }
    case 'monthly':
      return { kind, start: startOfMonth(anchor), end: endOfMonth(anchor), label: formatMonth(anchor), short: formatMonthShort(anchor) };
    case 'yearly':
      return { kind, start: startOfYear(anchor), end: endOfYear(anchor), label: anchor.slice(0, 4), short: anchor.slice(0, 4) };
  }
}

export function shiftAnchor(kind: PeriodKind, anchor: string, delta: number): string {
  switch (kind) {
    case 'daily':
      return addDays(anchor, delta);
    case 'weekly':
      return addDays(anchor, delta * 7);
    case 'monthly':
      return addMonths(startOfMonth(anchor), delta);
    case 'yearly':
      return addMonths(startOfYear(anchor), delta * 12);
  }
}

/** The `count` consecutive periods ending with the one containing `anchor`. */
export function trailingPeriods(kind: PeriodKind, anchor: string, count: number): Period[] {
  const out: Period[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(periodFor(kind, shiftAnchor(kind, anchor, -i)));
  return out;
}

export const live = <T extends { deletedAt?: string }>(xs: T[]) => xs.filter((x) => !x.deletedAt);

export function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export function txTotals(txs: Transaction[], start = '0000-01-01', end = '9999-12-31') {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.deletedAt || !inRange(t.date, start, end)) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income: round2(income), expense: round2(expense), net: round2(income - expense) };
}

export function loanActivity(loans: Loan[], start: string, end: string) {
  const ls = live(loans);
  const reps = ls.flatMap((l) => l.repayments.filter((r) => inRange(r.date, start, end)));
  return {
    lent: sumMoney([
      ...ls.filter((l) => inRange(l.startDate, start, end)).map((l) => l.principal),
      ...ls.flatMap((l) => (l.topUps ?? []).filter((t) => inRange(t.date, start, end)).map((t) => t.amount)),
    ]),
    repaid: sumMoney(reps.map((r) => r.amount)),
    principalRepaid: sumMoney(reps.map((r) => r.principalPortion)),
    interestEarned: sumMoney(reps.map((r) => r.interestPortion)),
  };
}

/** Full report for one period. Outstanding is measured as of the period end. */
export function periodReport(txs: Transaction[], loans: Loan[], p: Period, today: string) {
  const t = txTotals(txs, p.start, p.end);
  const la = loanActivity(loans, p.start, p.end);
  const asOf = p.end < today ? p.end : today;
  const pf = portfolio(loans, asOf);
  return {
    ...t,
    savings: t.net,
    ...la,
    investments: investmentTotal(txs, p.start, p.end),
    outstanding: pf.outstanding,
    interestPending: pf.interestPending,
  };
}

export function categoryBreakdown(txs: Transaction[], type: TxType, start: string, end: string) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.deletedAt || t.type !== type || !inRange(t.date, start, end)) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount), share: total ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Money moved into investments (expense transactions in the Investment category). */
export function investmentTotal(txs: Transaction[], start: string, end: string) {
  return round2(txs.filter((t) => !t.deletedAt && t.type === 'expense' && t.category === 'Investment' && inRange(t.date, start, end)).reduce((a, t) => a + t.amount, 0));
}

/**
 * Personal balance = income − expenses. Loans are deliberately NOT part of this:
 * money lent is not an expense and repayments are not income — they are tracked
 * in the separate Loans module.
 */
export function personalBalance(txs: Transaction[], asOf = '9999-12-31') {
  const t = txTotals(txs, '0000-01-01', asOf);
  return { ...t, balance: t.net };
}
