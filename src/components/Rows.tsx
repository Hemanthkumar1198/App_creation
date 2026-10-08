import clsx from 'clsx';
import { Check, ChevronRight, Phone, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Loan, Transaction } from '../types';
import { formatDate, relativeDays } from '../lib/dates';
import { formatINR } from '../lib/format';
import { describeRate, loanDescription, type LoanSummary } from '../lib/loans';
import { useUI } from '../store/useUI';
import { useStore } from '../store/useStore';
import { useSave } from '../lib/useSave';
import { Amount, CategoryIcon, Progress, StatusBadge } from './ui/common';

export function TransactionRow({
  t,
  showDate = true,
  deletable,
  selecting,
  selected,
  onToggle,
}: {
  t: Transaction;
  showDate?: boolean;
  /** Shows a delete button on the row (moves the entry to Trash, with Undo). */
  deletable?: boolean;
  /** Selection mode: tapping the row ticks it instead of opening it. */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: (t: Transaction) => void;
}) {
  const open = useUI((s) => s.open);
  const confirm = useUI((s) => s.confirm);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const restoreTransaction = useStore((s) => s.restoreTransaction);
  const { saving, run } = useSave();
  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this entry?',
      message: `${t.description || t.category} · ${formatINR(t.amount)} on ${formatDate(t.date)} will be moved to Trash. You can restore it from Settings → Trash.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) await run(() => deleteTransaction(t.id), 'Entry moved to Trash', { undo: () => void restoreTransaction(t.id) });
  };
  return (
    <div className={clsx('flex items-center gap-1 rounded-xl transition', selected && 'bg-rose-50 dark:bg-rose-500/10')}>
      <button
        onClick={() => (selecting ? onToggle?.(t) : open({ kind: 'tx', txType: t.type, editId: t.id }))}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5"
        aria-pressed={selecting ? !!selected : undefined}
      >
        {selecting && (
          <span
            className={clsx(
              'grid h-5 w-5 shrink-0 place-items-center rounded-md border-2',
              selected ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300 dark:border-white/20',
            )}
          >
            {selected && <Check size={14} strokeWidth={3} />}
          </span>
        )}
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
      {deletable && !selecting && (
        <button className="shrink-0 rounded-xl p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" onClick={remove} disabled={saving} aria-label={`Delete ${t.description || t.category} ${t.amount}`}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
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
          {loanDescription(loan) && <div className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{loanDescription(loan)}</div>}
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
