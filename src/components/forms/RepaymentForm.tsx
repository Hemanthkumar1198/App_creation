import clsx from 'clsx';
import { Loader2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Field, Row } from '../ui/common';
import { PAYMENT_METHODS } from '../../lib/categories';
import { formatDate, todayISO } from '../../lib/dates';
import { round2 } from '../../lib/finance';
import { formatINR } from '../../lib/format';
import { settlesInterest, suggestRepaymentSplit } from '../../lib/loans';
import { FullInterestToggle } from './InterestForm';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import { useSave } from '../../lib/useSave';
import type { PaymentMethod } from '../../types';

export function RepaymentForm({ loanId, editId, onClose }: { loanId: string; editId?: string; onClose: () => void }) {
  const loan = useStore((s) => s.loans.find((l) => l.id === loanId));
  const lastMethod = useStore((s) => s.settings.lastPaymentMethod);
  const addRepayment = useStore((s) => s.addRepayment);
  const updateRepayment = useStore((s) => s.updateRepayment);
  const deleteRepayment = useStore((s) => s.deleteRepayment);
  const confirm = useUI((s) => s.confirm);
  const { saving, run } = useSave();
  const existing = loan?.repayments.find((r) => r.id === editId);

  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [method, setMethod] = useState<PaymentMethod>(existing?.paymentMethod ?? lastMethod);
  const [auto, setAuto] = useState(!existing);
  const [principalPortion, setPrincipal] = useState(existing ? String(existing.principalPortion) : '');
  const [interestPortion, setInterest] = useState(existing ? String(existing.interestPortion) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [full, setFull] = useState(existing ? settlesInterest(existing) : false);
  const [error, setError] = useState('');

  const value = round2(parseFloat(amount) || 0);
  const due = useMemo(() => (loan ? suggestRepaymentSplit(loan, value, date, editId) : null), [loan, value, date, editId]);
  if (!loan || !due) return null;

  const pPortion = auto ? due.principalPortion : round2(parseFloat(principalPortion) || 0);
  const iPortion = auto ? due.interestPortion : round2(parseFloat(interestPortion) || 0);

  const save = async () => {
    if (!(value > 0)) return setError('Enter the amount received');
    if (date < loan.startDate) return setError(`Date cannot be before the loan start (${formatDate(loan.startDate)})`);
    if (value > due.outstanding + 0.009) return setError(`Repayment cannot exceed the outstanding amount of ${formatINR(due.outstanding, { paise: true })}`);
    if (pPortion < 0 || iPortion < 0) return setError('Portions cannot be negative');
    if (pPortion > due.principalDue + 0.009) return setError(`Principal portion cannot exceed ${formatINR(due.principalDue, { paise: true })}`);
    if (Math.abs(round2(pPortion + iPortion) - value) > 0.009) return setError(`Principal + interest must equal ${formatINR(value, { paise: true })}`);
    const payload = { amount: value, date, paymentMethod: method, principalPortion: pPortion, interestPortion: iPortion, notes: notes.trim(), settlesInterest: iPortion > 0 && full };
    const ok = existing
      ? await run(() => updateRepayment(loan.id, existing.id, payload), 'Repayment updated')
      : await run(() => addRepayment(loan.id, payload), `Repayment of ${formatINR(value)} recorded`);
    if (ok) onClose();
  };

  const del = async () => {
    if (!existing) return;
    const ok = await confirm({ title: 'Delete this repayment?', message: `${formatINR(existing.amount)} received on ${formatDate(existing.date)} will be removed and balances recalculated.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    if (await run(() => deleteRepayment(loan.id, existing.id), 'Repayment deleted')) onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit repayment' : 'Add repayment'}
      subtitle={`From ${loan.borrowerName} · recorded under Loans, not as income`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {existing && (
            <button className="btn-secondary text-rose-600 dark:text-rose-400" onClick={del} aria-label="Delete repayment">
              <Trash2 size={16} />
            </button>
          )}
          <button className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn flex-1 bg-emerald-600 text-white hover:bg-emerald-700" onClick={save} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Record repayment'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-slate-50 px-4 py-1 dark:bg-white/5">
          <Row label={`Interest due as of ${formatDate(date)}`} value={formatINR(due.interestDue, { paise: true })} tone="interest" />
          <Row label="Principal outstanding" value={formatINR(due.principalDue, { paise: true })} />
          <Row label="Total outstanding" value={formatINR(due.outstanding, { paise: true })} strong />
        </div>

        <div>
          <label className="label" htmlFor="rp-amount">Amount received</label>
          <div className="flex items-center rounded-2xl border-2 border-emerald-200 px-4 focus-within:border-emerald-500 dark:border-emerald-500/30">
            <span className="text-2xl font-bold text-emerald-600">₹</span>
            <input
              id="rp-amount"
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
                Interest only {formatINR(due.interestDue)}
              </button>
            )}
            {due.outstanding > 0 && (
              <button type="button" className="chip chip-off" onClick={() => setAmount(String(due.outstanding))}>
                Full settlement {formatINR(due.outstanding)}
              </button>
            )}
          </div>
          {value > due.outstanding + 0.009 && <p className="mt-1.5 text-xs font-medium text-rose-600">More than the outstanding balance of {formatINR(due.outstanding, { paise: true })}.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Repayment date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          </Field>
          <Field label="Payment method">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold">Split</span>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={auto}
                onChange={(e) => {
                  setAuto(e.target.checked);
                  if (!e.target.checked) {
                    setPrincipal(String(due.principalPortion));
                    setInterest(String(due.interestPortion));
                  }
                }}
              />
              Auto (interest first)
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Principal portion">
              <input
                className={clsx('input num', auto && 'bg-slate-50 dark:bg-white/5')}
                type="number"
                step="0.01"
                readOnly={auto}
                value={auto ? due.principalPortion : principalPortion}
                onChange={(e) => {
                  setPrincipal(e.target.value);
                  setInterest(String(round2(value - (parseFloat(e.target.value) || 0))));
                  setError('');
                }}
              />
            </Field>
            <Field label="Interest portion">
              <input
                className={clsx('input num', auto && 'bg-slate-50 dark:bg-white/5')}
                type="number"
                step="0.01"
                readOnly={auto}
                value={auto ? due.interestPortion : interestPortion}
                onChange={(e) => {
                  setInterest(e.target.value);
                  setPrincipal(String(round2(value - (parseFloat(e.target.value) || 0))));
                  setError('');
                }}
              />
            </Field>
          </div>
        </div>

        {iPortion > 0 && <FullInterestToggle full={full} onChange={setFull} date={date} />}

        <Field label="Notes">
          <input className="input" placeholder="e.g. Paid via GPay" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Sheet>
  );
}
