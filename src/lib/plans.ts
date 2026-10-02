import type { CalcNote, Plan, PlanFrequency, PlanKind } from '../types';
import { addMonths, diffDays, todayISO } from './dates';
import { round2, sumMoney } from './finance';

export const PLAN_KINDS: PlanKind[] = ['SIP', 'Mutual Fund', 'LIC', 'Term Insurance', 'Health Insurance', 'Vehicle Insurance', 'PPF', 'FD / RD', 'Gold', 'Other'];

export const PLAN_FREQ: { value: PlanFrequency; label: string; months: number; perYear: number }[] = [
  { value: 'monthly', label: 'Monthly', months: 1, perYear: 12 },
  { value: 'quarterly', label: 'Quarterly', months: 3, perYear: 4 },
  { value: 'half-yearly', label: 'Half-yearly', months: 6, perYear: 2 },
  { value: 'yearly', label: 'Yearly', months: 12, perYear: 1 },
  { value: 'one-time', label: 'No fixed schedule', months: 0, perYear: 0 },
];

export const isInsurance = (k: string) => /insurance|lic\b|policy/i.test(k);

export interface PlanSummary {
  totalPaid: number;
  paidThisYear: number;
  payments: number;
  lastPayment: { date: string; amount: number } | null;
  nextDueDate: string | null;
  daysToDue: number | null;
  overdue: boolean;
  ended: boolean;
  /** Expected yearly outflow at the current instalment. */
  yearlyCommitment: number;
}

/** Next due = last payment + one period (or the start date if nothing is paid yet). */
export function computePlan(plan: Plan, asOf: string = todayISO()): PlanSummary {
  const pays = [...plan.payments].sort((a, b) => a.date.localeCompare(b.date));
  const freq = PLAN_FREQ.find((f) => f.value === plan.frequency) ?? PLAN_FREQ[0];
  const last = pays.length ? pays[pays.length - 1] : null;
  const ended = !!plan.endDate && plan.endDate < asOf;
  let nextDueDate: string | null = null;
  // Free-form records (no fixed amount or schedule) just collect entries — no due dates.
  const scheduled = plan.amount > 0 && freq.months > 0;
  if (!ended && (scheduled || (plan.amount > 0 && !last))) {
    if (!last) nextDueDate = plan.startDate;
    else if (freq.months) nextDueDate = addMonths(last.date, freq.months);
    if (nextDueDate && plan.endDate && nextDueDate > plan.endDate) nextDueDate = null;
  }
  const daysToDue = nextDueDate ? diffDays(asOf, nextDueDate) : null;
  const year = asOf.slice(0, 4);
  return {
    totalPaid: sumMoney(pays.map((p) => p.amount)),
    paidThisYear: sumMoney(pays.filter((p) => p.date.startsWith(year)).map((p) => p.amount)),
    payments: pays.length,
    lastPayment: last ? { date: last.date, amount: last.amount } : null,
    nextDueDate,
    daysToDue,
    overdue: daysToDue !== null && daysToDue < 0,
    ended,
    yearlyCommitment: ended ? 0 : round2(plan.amount * freq.perYear),
  };
}

export function noteTotals(n: CalcNote) {
  const spent = sumMoney(n.entries.filter((e) => e.type === 'out').map((e) => e.amount));
  const received = sumMoney(n.entries.filter((e) => e.type === 'in').map((e) => e.amount));
  const last = n.entries.reduce((a, e) => (e.date > a ? e.date : a), '');
  return { spent, received, net: round2(received - spent), count: n.entries.length, lastDate: last || null };
}
