import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Field, Row } from '../ui/common';
import { PAYMENT_METHODS } from '../../lib/categories';
import { formatDate, todayISO } from '../../lib/dates';
import { round2 } from '../../lib/finance';
import { formatINR } from '../../lib/format';
import { computeLoan, suggestRepaymentSplit } from '../../lib/loans';
import { useSave } from '../../lib/useSave';
import { useStore } from '../../store/useStore';
import type { PaymentMethod } from '../../types';

/**
 * "Receive interest": records an interest-only payment from a borrower. The payment
 * date becomes the start of the next interest period, so what's due next is tracked from it.
 */
export function InterestForm({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const loan = useStore((s) => s.loans.find((l) => l.id === loanId));
  const lastMethod = useStore((s) => s.settings.lastPaymentMethod);
  const addRepayment = useStore((s) => s.addRepayment);
  const { saving, run } = useSave();
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(lastMethod);
  const [notes, setNotes] = useState('');
  const [full, setFull] = useState(true);
  const [error, setError] = useState('');

  const summary = useMemo(() => (loan ? computeLoan(loan) : null), [loan]);
  const due = useMemo(() => (loan ? suggestRepaymentSplit(loan, 0, date) : null), [loan, date]);
  if (!loan || !summary || !due) return null;

  const value = round2(parseFloat(amount) || 0);
  const periodLabel = summary.interestPeriodMonths === 1 ? '1 month' : `${summary.interestPeriodMonths} months`;

  const save = async () => {
    if (!(value > 0)) return setError('Enter the interest amount received');
    if (date < loan.startDate) return setError(`Date cannot be before the loan start (${formatDate(loan.startDate)})`);
    const ok = await run(
      () => addRepayment(loan.id, { amount: value, date, paymentMethod: method, principalPortion: 0, interestPortion: value, notes: notes.trim() || 'Interest received', settlesInterest: full }),
      `Interest of ${formatINR(value)} received from ${loan.borrowerName}`,
    );
    if (ok) onClose();
  };

  return (
    <Sheet
      title="Receive interest"
      subtitle={`From ${loan.borrowerName} · principal stays ${formatINR(summary.remainingPrincipal)}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn flex-1 bg-sky-600 text-white hover:bg-sky-700" onClick={save} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save interest'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-sky-50 px-4 py-1 dark:bg-sky-500/10">
          <Row label="Last interest received" value={summary.lastInterestPayment ? `${formatINR(summary.lastInterestPayment.amount)} on ${formatDate(summary.lastInterestPayment.date)}` : 'Never'} />
          {loan.interestRate > 0 ? (
            <>
              <Row label={`Interest due as of ${formatDate(date)}`} value={formatINR(due.interestDue, { paise: true })} tone="interest" strong />
              <Row label={`Interest for ${periodLabel}`} value={formatINR(summary.interestPerPeriod, { paise: true })} />
            </>
          ) : (
            <p className="py-2 text-xs text-slate-500 dark:text-slate-400">No interest rate set, so just enter what was received. Set the rate with Edit to see what's due.</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="int-amount">Interest received</label>
          <div className="flex items-center rounded-2xl border-2 border-sky-200 px-4 focus-within:border-sky-500 dark:border-sky-500/30">
            <span className="text-2xl font-bold text-sky-600">₹</span>
            <input
              id="int-amount"
              autoFocus
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
              className="num w-full bg-transparent px-2 py-3 text-2xl font-bold outline-none"
            />
          </div>
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
        </div>

        <FullInterestToggle full={full} onChange={setFull} date={date} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date received">
            <input type="date" className="input" value={date} min={loan.startDate} onChange={(e) => setDate(e.target.value || todayISO())} />
          </Field>
          <Field label="Payment method">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <input className="input" placeholder="e.g. Interest for October" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {full ? `Fresh interest is counted from ${formatDate(date)}.` : 'Interest not covered by this payment stays due.'} It is kept in Interest Calculation, not in daily Cash In.
        </p>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Sheet>
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
