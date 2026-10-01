import { ChevronRight, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Loan, Transaction } from '../types';
import { formatDate, relativeDays } from '../lib/dates';
import { formatINR } from '../lib/format';
import { describeRate, type LoanSummary } from '../lib/loans';
import { useUI } from '../store/useUI';
import { Amount, CategoryIcon, Progress, StatusBadge } from './ui/common';

export function TransactionRow({ t, showDate = true }: { t: Transaction; showDate?: boolean }) {
  const open = useUI((s) => s.open);
  return (
    <button
      onClick={() => open({ kind: 'tx', txType: t.type, editId: t.id })}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5"
    >
      <CategoryIcon category={t.category} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{t.description || t.category}</div>
        <div className="truncate text-xs text-slate-500 dark:text-slate-400">
          {t.category} · {t.paymentMethod}
          {showDate && <> · {formatDate(t.date)}</>}
        </div>
      </div>
      <Amount value={t.amount} type={t.type} className="text-sm" />
    </button>
  );
}

export function LoanCard({ loan, s }: { loan: Loan; s: LoanSummary }) {
  const initials = loan.borrowerName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Link to={`/loans/${loan.id}`} className="card card-pad group block transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-sm font-bold text-white">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-bold">{loan.borrowerName}</span>
            <StatusBadge status={s.status} />
          </div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {loan.phone && (
              <>
                <Phone size={11} /> {loan.phone} ·{' '}
              </>
            )}
            {describeRate(loan)}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500 dark:text-slate-400">Principal</div>
          <div className="num mt-0.5 text-sm font-bold">{formatINR(s.principal)}</div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-slate-400">Repaid</div>
          <div className="num mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(s.amountRepaid)}</div>
        </div>
        <div className="text-right">
          <div className="text-slate-500 dark:text-slate-400">Outstanding</div>
          <div className="num mt-0.5 text-sm font-bold text-violet-600 dark:text-violet-300">{formatINR(s.totalOutstanding)}</div>
        </div>
      </div>
      <Progress value={s.progress} className="mt-3" tone={s.status === 'fully-paid' ? 'income' : 'brand'} />
      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          {s.status === 'fully-paid'
            ? 'Closed'
            : s.nextDueDate
              ? `${s.installmentMissed ? 'Missed' : 'Next due'} ${formatDate(s.nextDueDate)} · ${relativeDays(s.nextDueDate)}`
              : `Due ${formatDate(loan.dueDate)}`}
        </span>
        <ChevronRight size={16} className="transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
