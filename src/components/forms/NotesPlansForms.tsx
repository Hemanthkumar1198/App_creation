import clsx from 'clsx';
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../ui/Sheet';
import { Field } from '../ui/common';
import { PAYMENT_METHODS } from '../../lib/categories';
import { formatDate, todayISO } from '../../lib/dates';
import { round2 } from '../../lib/finance';
import { formatINR } from '../../lib/format';
import { PLAN_FREQ, PLAN_KINDS, computePlan } from '../../lib/plans';
import { useSave } from '../../lib/useSave';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { PaymentMethod, PlanFrequency } from '../../types';

const NOTE_TEMPLATES = ['Paddy harvest', 'House construction', 'Farming', 'Wedding', 'Vehicle repair', 'Business stock', 'Trip'];

function SaveButton({ saving, label, onClick, tone = 'primary' }: { saving: boolean; label: string; onClick: () => void; tone?: 'primary' | 'green' | 'red' }) {
  const cls = tone === 'green' ? 'btn bg-emerald-600 text-white hover:bg-emerald-700' : tone === 'red' ? 'btn bg-rose-600 text-white hover:bg-rose-700' : 'btn-primary';
  return (
    <button className={`${cls} flex-1`} onClick={onClick} disabled={saving}>
      {saving && <Loader2 size={16} className="animate-spin" />}
      {saving ? 'Saving…' : label}
    </button>
  );
}

/* ------------------------------------------------------------ calculation */

export function NoteForm({ editId, onClose }: { editId?: string; onClose: () => void }) {
  const existing = useStore((s) => (editId ? s.notes.find((n) => n.id === editId) : undefined));
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const navigate = useNavigate();
  const { saving, run } = useSave();
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) return setError('Give it a name, e.g. "Paddy harvest 2026"');
    if (existing) {
      if (await run(() => updateNote(existing.id, { name, description }), 'Calculation renamed')) onClose();
      return;
    }
    let id = '';
    const ok = await run(async () => {
      const out = await addNote(name, description);
      id = out.id;
      return out;
    }, `"${name.trim()}" created`);
    if (ok) {
      onClose();
      navigate(`/notes/${id}`);
    }
  };

  return (
    <Sheet
      title={existing ? 'Rename calculation' : 'New calculation'}
      subtitle="A separate book for one purpose. Not mixed with your daily expenses."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <SaveButton saving={saving} label={existing ? 'Save' : 'Create'} onClick={save} />
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input className="input text-base" autoFocus placeholder="e.g. Paddy harvest 2026" value={name} onChange={(e) => (setName(e.target.value), setError(''))} />
        </Field>
        {!existing && (
          <div className="flex flex-wrap gap-2">
            {NOTE_TEMPLATES.map((t) => (
              <button key={t} type="button" className="chip chip-off" onClick={() => setName(`${t} ${new Date().getFullYear()}`)}>
                {t}
              </button>
            ))}
          </div>
        )}
        <Field label="Description (optional)">
          <input className="input" placeholder="e.g. 3 acres, Kharif season" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Sheet>
  );
}

export function NoteEntryForm({ noteId, editId, entryType = 'out', onClose }: { noteId: string; editId?: string; entryType?: 'in' | 'out'; onClose: () => void }) {
  const note = useStore((s) => s.notes.find((n) => n.id === noteId));
  const add = useStore((s) => s.addNoteEntry);
  const update = useStore((s) => s.updateNoteEntry);
  const remove = useStore((s) => s.deleteNoteEntry);
  const confirm = useUI((s) => s.confirm);
  const { saving, run } = useSave();
  const existing = note?.entries.find((e) => e.id === editId);
  const [type, setType] = useState<'in' | 'out'>(existing?.type ?? entryType);
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [description, setDescription] = useState(existing?.description ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState('');
  if (!note) return null;
  const value = round2(parseFloat(amount) || 0);

  const save = async (another = false) => {
    if (!(value > 0)) return setError('Enter an amount');
    if (!description.trim()) return setError('What was it for? e.g. "Labour", "Seeds", "Tractor"');
    const payload = { type, amount: value, date, description, notes };
    const ok = existing
      ? await run(() => update(note.id, existing.id, payload), 'Entry updated')
      : await run(() => add(note.id, payload), `${type === 'in' ? 'Received' : 'Spent'} ${formatINR(value)} · ${description.trim()}`);
    if (!ok) return;
    if (another) {
      setAmount('');
      setDescription('');
      setNotes('');
    } else onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit entry' : `Add to ${note.name}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {existing ? (
            <button
              className="btn-secondary text-rose-600"
              aria-label="Remove entry"
              onClick={async () => {
                if (await confirm({ title: 'Remove this entry?', message: `${existing.description} · ${formatINR(existing.amount)} will be removed from this calculation (a copy is kept in history).`, confirmLabel: 'Remove', danger: true }))
                  if (await run(() => remove(note.id, existing.id), 'Entry removed')) onClose();
              }}
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <button className="btn-secondary flex-1" disabled={saving} onClick={() => save(true)}>
              Save & add another
            </button>
          )}
          <SaveButton saving={saving} label={existing ? 'Save changes' : 'Save'} tone={type === 'in' ? 'green' : 'red'} onClick={() => save(false)} />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/5">
          {(['out', 'in'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={clsx('flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold', type === t ? (t === 'in' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'text-slate-500')}
            >
              {t === 'out' ? <Minus size={16} /> : <Plus size={16} />} {t === 'out' ? 'Spent' : 'Received'}
            </button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="ne-amount">Amount</label>
          <div className="flex items-center rounded-2xl border-2 border-slate-200 px-4 focus-within:border-brand-500 dark:border-white/10">
            <span className={clsx('text-2xl font-bold', type === 'in' ? 'text-emerald-600' : 'text-rose-600')}>₹</span>
            <input id="ne-amount" autoFocus type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => (setAmount(e.target.value), setError(''))} className="num w-full bg-transparent px-2 py-3 text-2xl font-bold outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="What for">
            <input className="input" placeholder={type === 'out' ? 'e.g. Labour, Seeds' : 'e.g. Paddy sale'} value={description} onChange={(e) => (setDescription(e.target.value), setError(''))} list="ne-suggest" />
            <datalist id="ne-suggest">
              {[...new Set(note.entries.map((e) => e.description))].slice(0, 20).map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <input className="input" placeholder="e.g. 5 workers × 2 days" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------- investments & insurance */

export function PlanForm({ editId, onClose }: { editId?: string; onClose: () => void }) {
  const existing = useStore((s) => (editId ? s.plans.find((p) => p.id === editId) : undefined));
  const addPlan = useStore((s) => s.addPlan);
  const updatePlan = useStore((s) => s.updatePlan);
  const navigate = useNavigate();
  const { saving, run } = useSave();
  const [f, setF] = useState({
    name: existing?.name ?? '',
    kind: existing?.kind ?? 'SIP',
    provider: existing?.provider ?? '',
    policyNumber: existing?.policyNumber ?? '',
    amount: existing ? String(existing.amount) : '',
    frequency: (existing?.frequency ?? 'monthly') as PlanFrequency,
    startDate: existing?.startDate ?? todayISO(),
    endDate: existing?.endDate ?? '',
    coverAmount: existing?.coverAmount ? String(existing.coverAmount) : '',
    notes: existing?.notes ?? '',
  });
  const [error, setError] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => (setF((p) => ({ ...p, [k]: v })), setError(''));

  const save = async () => {
    if (!f.name.trim()) return setError('Enter any name, e.g. "HDFC Index Fund SIP", "Gold savings", "Chit fund"');
    if (!f.kind.trim()) return setError('Choose or type a type');
    const amount = round2(parseFloat(f.amount) || 0);
    if (amount < 0) return setError('Amount cannot be negative');
    if (f.endDate && f.endDate <= f.startDate) return setError('End date must be after the start date');
    const payload = {
      name: f.name,
      kind: f.kind,
      provider: f.provider,
      policyNumber: f.policyNumber,
      amount,
      frequency: f.frequency,
      startDate: f.startDate,
      endDate: f.endDate || undefined,
      coverAmount: f.coverAmount ? round2(parseFloat(f.coverAmount) || 0) || undefined : undefined,
      notes: f.notes,
    };
    if (existing) {
      if (await run(() => updatePlan(existing.id, payload), 'Plan updated')) onClose();
      return;
    }
    let id = '';
    if (
      await run(async () => {
        const out = await addPlan(payload);
        id = out.id;
        return out;
      }, `"${f.name.trim()}" created`)
    ) {
      onClose();
      navigate(`/investments/${id}`);
    }
  };

  const insurance = /Insurance|LIC/.test(f.kind);

  return (
    <Sheet
      wide
      title={existing ? 'Edit record' : 'New investment / insurance record'}
      subtitle="Give it any name. Add entries inside it, just like monthly expenses."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <SaveButton saving={saving} label={existing ? 'Save changes' : 'Create'} onClick={save} />
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="label">Type (pick one or type your own)</span>
          <div className="flex flex-wrap gap-2">
            {PLAN_KINDS.map((k) => (
              <button key={k} type="button" className={clsx('chip', f.kind === k ? 'chip-on' : 'chip-off')} onClick={() => set('kind', k)}>
                {k}
              </button>
            ))}
          </div>
          <input className="input mt-2" placeholder="Or type any type, e.g. Chit fund, Post office, Crypto" value={(PLAN_KINDS as string[]).includes(f.kind) ? '' : f.kind} onChange={(e) => set('kind', e.target.value || 'Other')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className="input" autoFocus={!existing} placeholder={insurance ? 'e.g. LIC Jeevan Anand' : 'e.g. Nifty 50 Index Fund SIP'} value={f.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label={insurance ? 'Insurer' : 'Provider / AMC'}>
            <input className="input" placeholder={insurance ? 'e.g. LIC, HDFC Life' : 'e.g. Zerodha, Groww, SBI MF'} value={f.provider} onChange={(e) => set('provider', e.target.value)} />
          </Field>
          <Field label={insurance ? 'Regular premium (₹, optional)' : 'Regular instalment (₹, optional)'} hint="Leave empty if the amount varies: just add entries.">
            <input className="input num text-base font-semibold" type="number" inputMode="decimal" min="0" placeholder="e.g. 5000" value={f.amount} onChange={(e) => set('amount', e.target.value)} />
          </Field>
          <Field label="How often">
            <select className="input" value={f.frequency} onChange={(e) => set('frequency', e.target.value as PlanFrequency)}>
              {PLAN_FREQ.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date (first due)">
            <input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value || todayISO())} />
          </Field>
          <Field label="End / maturity date (optional)">
            <input className="input" type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
          <Field label={insurance ? 'Policy number (optional)' : 'Folio / account no. (optional)'}>
            <input className="input" value={f.policyNumber} onChange={(e) => set('policyNumber', e.target.value)} />
          </Field>
          <Field label={insurance ? 'Sum assured / cover (₹, optional)' : 'Target amount (₹, optional)'}>
            <input className="input num" type="number" min="0" value={f.coverAmount} onChange={(e) => set('coverAmount', e.target.value)} />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <input className="input" placeholder="e.g. Auto-debit on 5th, nominee: …" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Sheet>
  );
}

export function PlanPaymentForm({ planId, editId, onClose }: { planId: string; editId?: string; onClose: () => void }) {
  const plan = useStore((s) => s.plans.find((p) => p.id === planId));
  const lastMethod = useStore((s) => s.settings.lastPaymentMethod);
  const add = useStore((s) => s.addPlanPayment);
  const update = useStore((s) => s.updatePlanPayment);
  const remove = useStore((s) => s.deletePlanPayment);
  const confirm = useUI((s) => s.confirm);
  const { saving, run } = useSave();
  const existing = plan?.payments.find((p) => p.id === editId);
  const summary = plan ? computePlan(plan) : null;
  const [amount, setAmount] = useState(existing ? String(existing.amount) : plan && plan.amount > 0 ? String(plan.amount) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [date, setDate] = useState(existing?.date ?? (summary?.nextDueDate && summary.nextDueDate <= todayISO() ? todayISO() : todayISO()));
  const [method, setMethod] = useState<PaymentMethod>(existing?.paymentMethod ?? lastMethod);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState('');
  if (!plan || !summary) return null;
  const value = round2(parseFloat(amount) || 0);

  const save = async (another = false) => {
    if (!(value > 0)) return setError('Enter the amount');
    const payload = { amount: value, date, paymentMethod: method, description, notes };
    const ok = existing ? await run(() => update(plan.id, existing.id, payload), 'Entry updated') : await run(() => add(plan.id, payload), `${formatINR(value)} added to ${plan.name}`);
    if (!ok) return;
    if (another) {
      setAmount(plan.amount > 0 ? String(plan.amount) : '');
      setDescription('');
      setNotes('');
    } else onClose();
  };

  return (
    <Sheet
      title={existing ? 'Edit entry' : `Add entry to ${plan.name}`}
      subtitle={plan.kind}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {existing && (
            <button
              className="btn-secondary text-rose-600"
              aria-label="Remove payment"
              onClick={async () => {
                if (await confirm({ title: 'Remove this entry?', message: `${formatINR(existing.amount)} on ${formatDate(existing.date)} will be removed (a copy is kept in history).`, confirmLabel: 'Remove', danger: true }))
                  if (await run(() => remove(plan.id, existing.id), 'Entry removed')) onClose();
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
          {existing ? (
            <button className="btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
          ) : (
            <button className="btn-secondary flex-1" disabled={saving} onClick={() => save(true)}>
              Save & add another
            </button>
          )}
          <SaveButton saving={saving} label={existing ? 'Save changes' : 'Save'} onClick={() => save(false)} />
        </div>
      }
    >
      <div className="space-y-4">
        {!existing && summary.nextDueDate && plan.amount > 0 && (
          <p className={clsx('rounded-2xl p-3 text-sm', summary.overdue ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-slate-50 dark:bg-white/5')}>
            Due {formatDate(summary.nextDueDate)} · {formatINR(plan.amount)}
          </p>
        )}
        <div>
          <label className="label" htmlFor="pp-amount">Amount</label>
          <div className="flex items-center rounded-2xl border-2 border-slate-200 px-4 focus-within:border-brand-500 dark:border-white/10">
            <span className="text-2xl font-bold text-brand-600">₹</span>
            <input id="pp-amount" autoFocus type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => (setAmount(e.target.value), setError(''))} className="num w-full bg-transparent px-2 py-3 text-2xl font-bold outline-none" />
          </div>
        </div>
        <Field label="What for (optional)">
          <input className="input" placeholder="e.g. SIP October, Premium 2026, Gold coin" value={description} onChange={(e) => setDescription(e.target.value)} list="pp-suggest" />
          <datalist id="pp-suggest">
            {[...new Set(plan.payments.map((p) => p.description).filter(Boolean))].slice(0, 20).map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
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
        <Field label="Notes (optional)">
          <input className="input" placeholder="e.g. Receipt no., NAV, units" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Sheet>
  );
}
