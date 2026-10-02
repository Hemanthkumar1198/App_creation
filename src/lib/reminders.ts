import type { Loan, Transaction } from '../types';
import { addMonths, diffDays, endOfMonth, formatDate, formatMonth, relativeDays, startOfMonth, todayISO } from './dates';
import { formatINR } from './format';
import { computeLoan } from './loans';
import { txTotals, live } from './reports';

export interface Reminder {
  id: string;
  kind: 'overdue' | 'due-soon' | 'pending' | 'summary';
  title: string;
  message: string;
  date: string;
  loanId?: string;
}

export function buildReminders(loans: Loan[], txs: Transaction[], windowDays = 7, today = todayISO()): Reminder[] {
  const out: Reminder[] = [];
  for (const l of live(loans)) {
    const s = computeLoan(l, today);
    if (s.status === 'fully-paid') continue;
    if (s.status === 'overdue') {
      out.push({
        id: `od-${l.id}`,
        kind: 'overdue',
        loanId: l.id,
        date: l.dueDate,
        title: `${l.borrowerName}'s loan is overdue`,
        message: `${formatINR(s.totalOutstanding)} outstanding · was due ${formatDate(l.dueDate)} (${relativeDays(l.dueDate, today)})`,
      });
    } else if (s.installmentMissed && s.nextDueDate) {
      out.push({
        id: `pd-${l.id}`,
        kind: 'pending',
        loanId: l.id,
        date: s.nextDueDate,
        title: `Pending repayment from ${l.borrowerName}`,
        message: `Instalment of ~${formatINR(s.suggestedInstallment)} was due ${formatDate(s.nextDueDate)}`,
      });
    } else if (s.nextDueDate && s.daysToDue >= 0 && s.daysToDue <= windowDays) {
      out.push({
        id: `ds-${l.id}`,
        kind: 'due-soon',
        loanId: l.id,
        date: s.nextDueDate,
        title: `${l.borrowerName}'s repayment due ${relativeDays(s.nextDueDate, today)}`,
        message: `${formatINR(s.totalOutstanding)} outstanding · due ${formatDate(s.nextDueDate)}`,
      });
    }
  }
  // Interest instalments (tracked from the last time interest was received).
  for (const l of live(loans)) {
    const s = computeLoan(l, today);
    if (s.status === 'fully-paid' || !s.nextInterestDueDate || s.remainingInterest <= 0) continue;
    const days = diffDays(today, s.nextInterestDueDate);
    if (days > windowDays) continue;
    out.push({
      id: `int-${l.id}`,
      kind: days < 0 ? 'pending' : 'due-soon',
      loanId: l.id,
      date: s.nextInterestDueDate,
      title: days < 0 ? `Interest pending from ${l.borrowerName}` : `Interest from ${l.borrowerName} due ${relativeDays(s.nextInterestDueDate, today)}`,
      message: `${formatINR(s.remainingInterest)} interest due · last received ${s.lastInterestPayment ? formatDate(s.lastInterestPayment.date) : 'never'}`,
    });
  }

  const order = { overdue: 0, pending: 1, 'due-soon': 2, summary: 3 };
  out.sort((a, b) => order[a.kind] - order[b.kind] || a.date.localeCompare(b.date));

  // Monthly expense summary (last month vs the month before).
  const lastMonth = addMonths(startOfMonth(today), -1);
  const prevMonth = addMonths(lastMonth, -1);
  const lm = txTotals(txs, lastMonth, endOfMonth(lastMonth));
  const pm = txTotals(txs, prevMonth, endOfMonth(prevMonth));
  if (lm.expense > 0 || lm.income > 0) {
    const diff = pm.expense ? ((lm.expense - pm.expense) / pm.expense) * 100 : 0;
    out.push({
      id: `sum-${lastMonth}`,
      kind: 'summary',
      date: lastMonth,
      title: `${formatMonth(lastMonth)} summary`,
      message: `Spent ${formatINR(lm.expense)}${pm.expense ? ` (${diff >= 0 ? '+' : ''}${diff.toFixed(0)}% vs previous month)` : ''} · earned ${formatINR(lm.income)} · saved ${formatINR(lm.net)}`,
    });
  }
  return out;
}
