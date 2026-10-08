import clsx from 'clsx';
import { CheckCircle2, HandCoins, HelpCircle, Loader2, Percent, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Sheet } from '../ui/Sheet';
import { Field, Row } from '../ui/common';
import { PAYMENT_METHODS } from '../../lib/categories';
import { formatDate, todayISO } from '../../lib/dates';
import { round2 } from '../../lib/finance';
import { formatINR } from '../../lib/format';
import { computeLoan, isUnknownInterest, settlesInterest, suggestRepaymentSplit } from '../../lib/loans';
import { useSave } from '../../lib/useSave';
import { useStore, type RepaymentInput } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { Loan, PaymentMethod, Repayment } from '../../types';

type Mode = 'interest' | 'unknown' | 'full';

/** "Receive interest" sheet, or "Edit interest received" when `editId` is an interest receipt. */
export function InterestForm({ loanId, editId, onClose }: { loanId: string; editId?: string; onClose: () => void }) {
  const loan = useStore((s) => s.loans.find((l) => l.id === loanId));
  if (!loan) return null;
  const edit = editId ? loan.repayments.find((r) => r.id === editId) : undefined;
  const principal = computeLoan(loan).remainingPrincipal;
  return (
    <Sheet
      title={edit ? 'Edit interest received' : 'Receive interest'}
      subtitle={`${edit ? `${loan.borrowerName} · ${formatDate(edit.date)}` : `From ${loan.borrowerName}`} · amount lent ${formatINR(principal)}`}
      onClose={onClose}
    >
      <ReceiveInterestPanel key={edit?.id ?? 'new'} loan={loan} edit={edit} onDone={onClose} onCancel={onClose} />
    </Sheet>
  );
}

/**
 * Three ways to record what a borrower paid:
 * - Interest amount received (full interest till the date, or only part of it)
 * - Interest received, amount not known: interest simply restarts from the date
 * - Full loan amount received: amount lent + interest, the record is closed as Fully Repaid
 */
export function ReceiveInterestPanel({ loan, edit, onDone, onCancel }: { loan: Loan; edit?: Repayment; onDone?: () => void; onCancel?: () => void }) {
  const lastMethod = useStore((s) => s.settings.lastPaymentMethod);
  const addRepayment = useStore((s) => s.addRepayment);
  const updateRepayment = useStore((s) => s.updateRepayment);
  const deleteRepayment = useStore((s) => s.deleteRepayment);
  const closeLoan = useStore((s) => s.closeLoan);
  const confirm = useUI((s) => s.confirm);
  const { saving, run } = useSave();
  const [mode, setMode] = useState<Mode>(edit ? (isUnknownInterest(edit) ? 'unknown' : 'interest') : 'interest');
  const [date, setDate] = useState(edit?.date ?? todayISO());
  const [amount, setAmount] = useState(edit && edit.amount > 0 ? String(edit.amount) : '');
  const [method, setMethod] = useState<PaymentMethod>(edit?.paymentMethod ?? lastMethod);
  const [notes, setNotes] = useState(edit?.notes ?? '');
  const [full, setFull] = useState(edit ? settlesInterest(edit) : true);
  const [error, setError] = useState('');

  // When editing, figures are worked out without this receipt.
  const base = useMemo(() => (edit ? { ...loan, repayments: loan.repayments.filter((r) => r.id !== edit.id) } : loan), [loan, edit]);
  const summary = useMemo(() => computeLoan(base), [base]);
  const due = useMemo(() => suggestRepaymentSplit(base, 0, date), [base, date]);
  const value = round2(parseFloat(amount) || 0);
  const hasRate = loan.interestRate > 0;
  const periodLabel = summary.interestPeriodMonths === 1 ? '1 month' : `${summary.interestPeriodMonths} months`;
  const fullTotal = round2(due.principalDue + due.interestDue);

  const pickMode = (m: Mode) => {
    setMode(m);
    setError('');
    setAmount(m === 'full' ? String(fullTotal) : '');
  };

  const reset = () => {
    setAmount('');
    setNotes('');
    setError('');
  };

  const save = async () => {
    if (date < loan.startDate) return setError(`Date cannot be before the lending date (${formatDate(loan.startDate)})`);
    const note = notes.trim();
    let ok = false;
    const write = (input: RepaymentInput) => (edit ? updateRepayment(loan.id, edit.id, input) : addRepayment(loan.id, input));
    if (mode === 'unknown') {
      ok = await run(
        () => write({ amount: 0, date, paymentMethod: method, principalPortion: 0, interestPortion: 0, notes: note || 'Interest received (amount not recorded)', settlesInterest: true }),
        `${edit ? 'Updated: interest' : 'Interest'} marked as received on ${formatDate(date)}. Fresh interest counted from this date.`,
      );
    } else if (mode === 'interest') {
      if (!(value > 0)) return setError('Enter the interest amount received');
      ok = await run(
        () => write({ amount: value, date, paymentMethod: method, principalPortion: 0, interestPortion: value, notes: note || 'Interest received', settlesInterest: full }),
        `${edit ? 'Updated: interest' : 'Interest'} of ${formatINR(value)} received on ${formatDate(date)}.${full ? ' Fresh interest counted from this date.' : ''}`,
      );
    } else {
      if (!(value > 0)) return setError('Enter the total amount received');
      if (value + 0.009 < due.principalDue)
        return setError(`That's less than the amount still lent (${formatINR(due.principalDue)}). For part of the loan use "Add Repayment".`);
      const principalPortion = due.principalDue;
      const interestPortion = round2(value - principalPortion);
      ok = await run(
        () =>
          closeLoan(loan.id, date, { amount: value, date, paymentMethod: method, principalPortion, interestPortion, notes: note || 'Full loan amount received', settlesInterest: true }),
        `${loan.borrowerName} paid back in full (${formatINR(value)}). Record marked Fully Repaid.`,
      );
    }
    if (ok) {
      reset();
      onDone?.();
    }
  };

  const remove = async () => {
    if (!edit) return;
    const yes = await confirm({
      title: 'Remove this interest entry?',
      message: `${isUnknownInterest(edit) ? 'Interest (amount not recorded)' : formatINR(edit.amount)} received on ${formatDate(edit.date)} will be removed and interest recalculated.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (yes && (await run(() => deleteRepayment(loan.id, edit.id), 'Interest entry removed'))) onDone?.();
  };

  const saveLabel = edit ? 'Save changes' : mode === 'full' ? 'Save & close record' : mode === 'unknown' ? 'Mark interest received' : 'Save interest';

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <ModeOption on={mode === 'interest'} onClick={() => pickMode('interest')} icon={<Percent size={16} />} title="Interest amount received" text="Enter how much interest they paid. The amount lent stays the same." />
        <ModeOption on={mode === 'unknown'} onClick={() => pickMode('unknown')} icon={<HelpCircle size={16} />} title="Interest received, amount not known" text="Just mark interest as received. Fresh interest is counted from the date." />
        {!edit && <ModeOption on={mode === 'full'} onClick={() => pickMode('full')} icon={<HandCoins size={16} />} title="Full loan amount received" text="They returned the amount lent with interest. The record is closed as Fully Repaid." />}
      </div>

      <div className="rounded-2xl bg-sky-50 px-4 py-1 dark:bg-sky-500/10">
        <Row label="Last interest received" value={summary.lastInterestPayment ? `${summary.lastInterestPayment.amountUnknown ? 'Amount not recorded' : formatINR(summary.lastInterestPayment.amount)} · ${formatDate(summary.lastInterestPayment.date)}` : 'Never'} />
        {mode === 'full' && <Row label="Amount lent (still with them)" value={formatINR(due.principalDue, { paise: true })} />}
        {hasRate ? (
          <>
            <Row label={`Interest due as of ${formatDate(date)}`} value={formatINR(due.interestDue, { paise: true })} tone="interest" strong={mode !== 'full'} />
            {mode === 'full' ? (
              <Row label="Total to settle" value={formatINR(fullTotal, { paise: true })} strong />
            ) : (
              <Row label={`Interest for ${periodLabel}`} value={formatINR(summary.interestPerPeriod, { paise: true })} />
            )}
          </>
        ) : (
          <p className="py-2 text-xs text-slate-500 dark:text-slate-400">No interest rate set, so the app can't work out what's due. Set the rate with Edit, or just enter what was received.</p>
        )}
      </div>

      {mode !== 'unknown' && (
        <div>
          <label className="label" htmlFor="int-amount">
            {mode === 'full' ? 'Total amount received (amount lent + interest)' : 'Interest received'}
          </label>
          <div className="flex items-center rounded-2xl border-2 border-sky-200 px-4 focus-within:border-sky-500 dark:border-sky-500/30">
            <span className="text-2xl font-bold text-sky-600">₹</span>
            <input
              id="int-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  save();
                }
              }}
              className="num w-full bg-transparent px-2 py-3 text-2xl font-bold outline-none"
            />
          </div>
          {mode === 'interest' && (
            <div className="mt-2 flex flex-wrap gap-2">
              {due.interestDue > 0 && (
                <button type="button" className="chip chip-off" onClick={() => setAmount(String(due.interestDue))}>
                  All due {formatINR(due.interestDue)}
                </button>
              )}
              {summary.interestPerPeriod > 0 && (
                <button type="button" className="chip chip-off" onClick={() => setAmount(String(summary.interestPerPeriod))}>
                  {periodLabel} {formatINR(summary.interestPerPeriod)}
                </button>
              )}
            </div>
          )}
          {mode === 'full' && value > 0 && value + 0.009 >= due.principalDue && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {formatINR(due.principalDue)} amount lent + {formatINR(round2(value - due.principalDue))} interest
            </p>
          )}
        </div>
      )}

      {mode === 'interest' && <FullInterestToggle full={full} onChange={setFull} date={date} />}

      <div className={clsx('grid gap-3', mode === 'unknown' ? 'grid-cols-1' : 'grid-cols-2')}>
        <Field label={mode === 'unknown' ? 'Interest received on' : 'Date received'}>
          <input type="date" className="input" value={date} min={loan.startDate} onChange={(e) => setDate(e.target.value || todayISO())} />
        </Field>
        {mode !== 'unknown' && (
          <Field label="Payment method">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <Field label="Description">
        <input className="input" placeholder="e.g. Interest for October, paid at home" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {mode === 'full'
          ? 'Any interest not covered is written off when the record closes. You can reopen it later.'
          : mode === 'unknown' || full
            ? `All interest up to ${formatDate(date)} is cleared. Fresh interest is counted from this date.`
            : 'Interest not covered by this payment stays due.'}{' '}
        Kept in Interest Calculation, not in daily Cash In.
      </p>
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      <div className="flex gap-2">
        {edit && (
          <button type="button" className="btn-secondary text-rose-600 dark:text-rose-400" onClick={remove} disabled={saving} aria-label="Remove interest entry">
            <Trash2 size={16} />
          </button>
        )}
        {onCancel && (
          <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn flex-1 bg-sky-600 text-white hover:bg-sky-700" onClick={save} disabled={saving}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  );
}

function ModeOption({ on, onClick, icon, title, text }: { on: boolean; onClick: () => void; icon: ReactNode; title: string; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        'flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition',
        on ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10',
      )}
    >
      <span className={clsx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl', on ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/10')}>{icon}</span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{text}</span>
      </span>
      {on && <CheckCircle2 size={18} className="mt-1 shrink-0 text-sky-600" />}
    </button>
  );
}

/** "Full interest till this date received" vs. a part payment of interest. */
export function FullInterestToggle({ full, onChange, date }: { full: boolean; onChange: (v: boolean) => void; date: string }) {
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
        <input type="radio" className="mt-1 h-4 w-4 accent-sky-600" checked={full} onChange={() => onChange(true)} />
        <span className="text-sm">
          <span className="font-semibold">Full interest received till {formatDate(date)}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">Clears all interest up to this date. Fresh interest starts from this date.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
        <input type="radio" className="mt-1 h-4 w-4 accent-sky-600" checked={!full} onChange={() => onChange(false)} />
        <span className="text-sm">
          <span className="font-semibold">Part of the interest only</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">The rest of the interest up to this date stays due.</span>
        </span>
      </label>
    </div>
  );
}
