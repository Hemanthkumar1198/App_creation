import clsx from 'clsx';
import { ChevronDown, Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Field } from '../ui/common';
import { categoriesFor, PAYMENT_METHODS } from '../../lib/categories';
import { addDays, todayISO } from '../../lib/dates';
import { round2 } from '../../lib/finance';
import { formatINR } from '../../lib/format';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import { useSave } from '../../lib/useSave';
import type { PaymentMethod, TxType } from '../../types';

export function TransactionForm({ txType, editId, defaultDate, onClose }: { txType: TxType; editId?: string; defaultDate?: string; onClose: () => void }) {
  const existing = useStore((s) => (editId ? s.transactions.find((t) => t.id === editId) : undefined));
  const lastMethod = useStore((s) => s.settings.lastPaymentMethod);
  const add = useStore((s) => s.addTransaction);
  const update = useStore((s) => s.updateTransaction);
  const remove = useStore((s) => s.deleteTransaction);
  const restore = useStore((s) => s.restoreTransaction);
  const confirm = useUI((s) => s.confirm);
  const { saving, run } = useSave();

  const [type, setType] = useState<TxType>(existing?.type ?? txType);
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [date, setDate] = useState(existing?.date ?? defaultDate ?? todayISO());
  const [category, setCategory] = useState(existing?.category ?? (txType === 'income' ? 'Salary' : 'Food'));
  const [description, setDescription] = useState(existing?.description ?? '');
  const [method, setMethod] = useState<PaymentMethod>(existing?.paymentMethod ?? lastMethod);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [more, setMore] = useState(!!existing?.notes);
  const [error, setError] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  const cats = useMemo(() => categoriesFor(type), [type]);
  const value = round2(parseFloat(amount));
  const isIncome = type === 'income';

  const switchType = (t: TxType) => {
    setType(t);
    if (!categoriesFor(t).some((c) => c.name === category)) setCategory(t === 'income' ? 'Salary' : 'Food');
  };

  const save = async (addAnother = false) => {
    if (!(value > 0)) {
      setError('Enter an amount greater than ₹0');
      amountRef.current?.focus();
      return;
    }
    if (value > 1e11) return setError('Amount is too large');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Choose a valid date');
    const payload = { type, amount: value, date, category, description: description.trim() || category, paymentMethod: method, notes: notes.trim() };
    const ok = existing
      ? await run(() => update(existing.id, payload), 'Transaction updated')
      : await run(() => add(payload), `${isIncome ? 'Cash in' : 'Cash out'} of ${formatINR(value)} saved`);
    if (!ok) return;
    if (addAnother) {
      setAmount('');
      setDescription('');
      setNotes('');
      setError('');
      amountRef.current?.focus();
    } else onClose();
  };

  const del = async () => {
    if (!existing) return;
    const ok = await confirm({ title: 'Delete this transaction?', message: `${existing.category} · ${formatINR(existing.amount)} will be moved to trash. You can restore it from Settings → Trash.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    if (await run(() => remove(existing.id), 'Transaction moved to trash', { undo: () => void restore(existing.id) })) onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit transaction' : isIncome ? 'Cash In' : 'Cash Out'}
      subtitle={existing ? undefined : isIncome ? 'Record money you received' : 'Record money you spent'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {existing ? (
            <button className="btn-secondary text-rose-600 dark:text-rose-400" onClick={del} disabled={saving} aria-label="Delete">
              <Trash2 size={16} />
            </button>
          ) : (
            <button className="btn-secondary flex-1" disabled={saving} onClick={() => save(true)}>
              Save &amp; add another
            </button>
          )}
          <button
            className={clsx('btn flex-1 text-white', isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700')}
            disabled={saving}
            onClick={() => save(false)}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Save'}
          </button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/5">
          {(['income', 'expense'] as TxType[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => switchType(t)}
              className={clsx(
                'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition',
                type === t ? (t === 'income' ? 'bg-emerald-600 text-white shadow' : 'bg-rose-600 text-white shadow') : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {t === 'income' ? <Plus size={16} /> : <Minus size={16} />} {t === 'income' ? 'Cash In' : 'Cash Out'}
            </button>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="tx-amount">Amount</label>
          <div className={clsx('flex items-center rounded-2xl border-2 px-4 transition', error ? 'border-rose-400' : isIncome ? 'border-emerald-200 focus-within:border-emerald-500 dark:border-emerald-500/30' : 'border-rose-200 focus-within:border-rose-500 dark:border-rose-500/30')}>
            <span className={clsx('text-3xl font-bold', isIncome ? 'text-emerald-600' : 'text-rose-600')}>₹</span>
            <input
              id="tx-amount"
              ref={amountRef}
              autoFocus
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              className="num w-full bg-transparent px-2 py-3 text-3xl font-bold outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
          </div>
          {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
        </div>

        <div>
          <span className="label">Category</span>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {cats.map((c) => (
              <button
                type="button"
                key={c.name}
                onClick={() => setCategory(c.name)}
                className={clsx(
                  'flex flex-col items-center gap-1.5 rounded-2xl border p-2 text-[11px] font-medium transition',
                  category === c.name ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20 dark:bg-brand-500/15 dark:text-brand-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300',
                )}
              >
                <span className={clsx('grid h-9 w-9 place-items-center rounded-xl', c.tone)}>
                  <c.icon size={17} />
                </span>
                <span className="w-full truncate text-center">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          </Field>
          <Field label="Description">
            <input className="input" placeholder={category} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <div className="-mt-2 flex gap-2">
          {[
            ['Today', todayISO()],
            ['Yesterday', addDays(todayISO(), -1)],
          ].map(([l, d]) => (
            <button type="button" key={l} onClick={() => setDate(d)} className={clsx('chip', date === d ? 'chip-on' : 'chip-off')}>
              {l}
            </button>
          ))}
        </div>

        <div>
          <span className="label">Payment method</span>
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {PAYMENT_METHODS.map((m) => (
              <button type="button" key={m} onClick={() => setMethod(m)} className={clsx('chip shrink-0', method === m ? 'chip-on' : 'chip-off')}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {more ? (
          <Field label="Notes">
            <textarea className="input min-h-[72px]" placeholder="Anything to remember…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        ) : (
          <button type="button" className="flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-300" onClick={() => setMore(true)}>
            <ChevronDown size={16} /> Add notes
          </button>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
