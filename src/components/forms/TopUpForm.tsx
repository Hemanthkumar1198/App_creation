import { Loader2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Field, Row } from '../ui/common';
import { formatDate, todayISO } from '../../lib/dates';
import { round2 } from '../../lib/finance';
import { formatINR } from '../../lib/format';
import { computeLoan, describeRate } from '../../lib/loans';
import { useSave } from '../../lib/useSave';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';

/**
 * "Give more money": another amount lent to the same person on a later date.
 * Interest on it is counted from its own date; the earlier amount keeps its own dates.
 */
export function TopUpForm({ loanId, editId, onClose }: { loanId: string; editId?: string; onClose: () => void }) {
  const loan = useStore((s) => s.loans.find((l) => l.id === loanId));
  const addTopUp = useStore((s) => s.addTopUp);
  const updateTopUp = useStore((s) => s.updateTopUp);
  const deleteTopUp = useStore((s) => s.deleteTopUp);
  const confirm = useUI((s) => s.confirm);
  const { saving, run } = useSave();
  const existing = loan?.topUps?.find((t) => t.id === editId);
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState('');

  // Amount still with them on that date, without this entry.
  const before = useMemo(() => {
    if (!loan) return null;
    const others = { ...loan, closedAt: undefined, topUps: (loan.topUps ?? []).filter((t) => t.id !== editId) };
    return computeLoan(others, date < loan.startDate ? loan.startDate : date);
  }, [loan, editId, date]);
  if (!loan || !before) return null;

  const value = round2(parseFloat(amount) || 0);

  const save = async () => {
    if (!(value > 0)) return setError('Enter the amount you gave');
    if (date < loan.startDate) return setError(`Date cannot be before the first amount (${formatDate(loan.startDate)})`);
    const input = { date, amount: value, notes };
    const ok = existing
      ? await run(() => updateTopUp(loan.id, existing.id, input), 'Amount updated')
      : await run(() => addTopUp(loan.id, input), `Gave ${formatINR(value)} more to ${loan.borrowerName}. Interest on it counts from ${formatDate(date)}.`);
    if (ok) onClose();
  };

  const del = async () => {
    if (!existing) return;
    const yes = await confirm({
      title: 'Remove this amount?',
      message: `${formatINR(existing.amount)} given on ${formatDate(existing.date)} will be removed and interest recalculated.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (yes && (await run(() => deleteTopUp(loan.id, existing.id), 'Amount removed'))) onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit amount given' : 'Give more money'}
      subtitle={`To ${loan.borrowerName} · same record, ${describeRate(loan)}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {existing && (
            <button className="btn-secondary text-rose-600 dark:text-rose-400" onClick={del} aria-label="Remove amount">
              <Trash2 size={16} />
            </button>
          )}
          <button className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add amount'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="topup-amount">Amount given now (₹)</label>
          <div className="flex items-center rounded-2xl border-2 border-violet-200 px-4 focus-within:border-violet-500 dark:border-violet-500/30">
            <span className="text-2xl font-bold text-violet-600">₹</span>
            <input
              id="topup-amount"
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
        </div>
        <Field label="Date given">
          <input type="date" className="input" value={date} min={loan.startDate} onChange={(e) => setDate(e.target.value || todayISO())} />
        </Field>
        <Field label="Description">
          <input className="input" placeholder="e.g. Second amount for house work" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="rounded-2xl bg-violet-50 px-4 py-1 dark:bg-violet-500/10">
          <Row label={`Already with them on ${formatDate(date)}`} value={formatINR(before.remainingPrincipal)} />
          <Row label="Giving now" value={`+ ${formatINR(value)}`} />
          <Row label={`Interest from ${formatDate(date)} is on`} value={formatINR(round2(before.remainingPrincipal + value))} strong />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Interest on the earlier amount keeps counting from its own date, and interest on this amount starts from {formatDate(date)}. When they pay interest, it covers both.
        </p>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Sheet>
  );
}
