import clsx from 'clsx';
import { Calculator, Loader2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../ui/Sheet';
import { Field, Row, Segmented } from '../ui/common';
import { addMonths, monthsBetween, todayISO } from '../../lib/dates';
import { round2 } from '../../lib/finance';
import { formatINR } from '../../lib/format';
import { expectedInterest, installmentCount } from '../../lib/loans';
import { useStore, type LoanInput } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import { useSave } from '../../lib/useSave';
import type { Compounding, InterestMethod, InterestType, Loan, PaymentFrequency } from '../../types';

const FREQS: { value: PaymentFrequency; label: string }[] = [
  { value: 'one-time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Yearly' },
];

export function LoanForm({ editId, onClose }: { editId?: string; onClose: () => void }) {
  const existing = useStore((s) => (editId ? s.loans.find((l) => l.id === editId) : undefined));
  const addLoan = useStore((s) => s.addLoan);
  const updateLoan = useStore((s) => s.updateLoan);
  const deleteLoan = useStore((s) => s.deleteLoan);
  const restoreLoan = useStore((s) => s.restoreLoan);
  const confirm = useUI((s) => s.confirm);
  const { saving, run } = useSave();
  const navigate = useNavigate();

  const today = todayISO();
  const [f, setF] = useState({
    borrowerName: existing?.borrowerName ?? '',
    phone: existing?.phone ?? '',
    principal: existing ? String(existing.principal) : '',
    startDate: existing?.startDate ?? today,
    interestRate: existing ? String(existing.interestRate) : '2',
    interestType: (existing?.interestType ?? 'monthly') as InterestType,
    interestMethod: (existing?.interestMethod ?? 'simple') as InterestMethod,
    compounding: (existing?.compounding ?? 'monthly') as Compounding,
    durationMonths: existing ? String(existing.durationMonths) : '6',
    dueDate: existing?.dueDate ?? addMonths(today, 6),
    paymentFrequency: (existing?.paymentFrequency ?? 'one-time') as PaymentFrequency,
    interestEndDate: existing?.interestEndDate ?? '',
    notes: existing?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const setDuration = (v: string) => {
    const n = parseFloat(v);
    setF((p) => ({ ...p, durationMonths: v, dueDate: n > 0 ? addMonths(p.startDate, Math.round(n)) : p.dueDate }));
  };
  const setDue = (v: string) => {
    setF((p) => ({ ...p, dueDate: v, durationMonths: v > p.startDate ? String(round2(monthsBetween(p.startDate, v))) : p.durationMonths }));
  };
  const setStart = (v: string) => {
    const n = parseFloat(f.durationMonths);
    setF((p) => ({ ...p, startDate: v, dueDate: n > 0 ? addMonths(v, Math.round(n)) : p.dueDate }));
  };

  const draft: Loan = useMemo(
    () => ({
      id: 'draft',
      borrowerName: f.borrowerName,
      phone: f.phone,
      principal: round2(parseFloat(f.principal) || 0),
      startDate: f.startDate,
      interestRate: parseFloat(f.interestRate) || 0,
      interestType: f.interestType,
      interestMethod: f.interestMethod,
      compounding: f.compounding,
      dueDate: f.dueDate,
      durationMonths: parseFloat(f.durationMonths) || 0,
      paymentFrequency: f.paymentFrequency,
      notes: f.notes,
      repayments: [],
      createdAt: '',
      updatedAt: '',
    }),
    [f],
  );
  const preview = useMemo(() => {
    if (!(draft.principal > 0) || draft.dueDate <= draft.startDate) return null;
    const interest = expectedInterest(draft);
    const n = installmentCount(draft);
    return { interest, total: round2(draft.principal + interest), n, perInstallment: round2((draft.principal + interest) / n) };
  }, [draft]);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.borrowerName.trim()) e.borrowerName = "Enter the borrower's name";
    if (!(draft.principal > 0)) e.principal = 'Enter the amount lent';
    if (draft.interestRate < 0) e.interestRate = 'Rate cannot be negative';
    if (f.dueDate <= f.startDate) e.dueDate = 'Due date must be after the start date';
    if (f.phone && !/^[+\d][\d\s-]{6,}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number';
    if (f.interestEndDate && f.interestEndDate < f.startDate) e.interestEndDate = 'Must be on/after the start date';
    if (draft.interestType !== 'fixed' && draft.interestRate > 100) e.interestRate = 'Rate looks too high (max 100%)';
    if (!f.startDate) e.startDate = 'Choose a start date';
    if (draft.principal > 1e11) e.principal = 'Amount is too large';
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;

    const payload: LoanInput = {
      borrowerName: f.borrowerName.trim(),
      phone: f.phone.trim(),
      principal: draft.principal,
      startDate: f.startDate,
      interestRate: draft.interestRate,
      interestType: f.interestType,
      interestMethod: f.interestType === 'fixed' ? 'simple' : f.interestMethod,
      compounding: f.compounding,
      dueDate: f.dueDate,
      durationMonths: round2(monthsBetween(f.startDate, f.dueDate)),
      paymentFrequency: f.paymentFrequency,
      interestEndDate: f.interestEndDate || undefined,
      notes: f.notes.trim(),
    };
    if (existing) {
      if (await run(() => updateLoan(existing.id, payload), 'Loan updated')) onClose();
    } else {
      let id = '';
      const ok = await run(async () => {
        const out = await addLoan(payload);
        id = out.id;
        return out;
      }, `Interest record for ${payload.borrowerName} (${formatINR(payload.principal)}) added`);
      if (ok) {
        onClose();
        navigate(`/loans/${id}`);
      }
    }
  };

  const del = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete loan to ${existing.borrowerName}?`,
      message: `The loan and its ${existing.repayments.length} repayment(s) will be moved to trash. You can restore it from Settings → Trash.`,
      confirmLabel: 'Delete loan',
      danger: true,
    });
    if (!ok) return;
    if (await run(() => deleteLoan(existing.id), 'Loan moved to trash', { undo: () => void restoreLoan(existing.id) })) {
      onClose();
      navigate('/loans');
    }
  };

  const isFixed = f.interestType === 'fixed';

  return (
    <Sheet
      wide
      title={existing ? 'Edit interest record' : 'New interest record'}
      subtitle={existing ? existing.borrowerName : 'Money you lent to someone (kept separate from your expenses)'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {existing && (
            <button className="btn-secondary text-rose-600 dark:text-rose-400" onClick={del} aria-label="Delete loan">
              <Trash2 size={16} />
            </button>
          )}
          <button className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add record'}
          </button>
        </div>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Borrower's name" hint={errors.borrowerName && <span className="text-rose-600">{errors.borrowerName}</span>}>
            <input className="input" autoFocus={!existing} placeholder="e.g. Rahul" value={f.borrowerName} onChange={(e) => set('borrowerName', e.target.value)} />
          </Field>
          <Field label="Phone number" hint={errors.phone && <span className="text-rose-600">{errors.phone}</span>}>
            <input className="input" type="tel" inputMode="tel" placeholder="98765 43210" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Amount lent (₹)" hint={errors.principal && <span className="text-rose-600">{errors.principal}</span>}>
            <input className="input num text-base font-semibold" type="number" inputMode="decimal" min="0" step="0.01" placeholder="50000" value={f.principal} onChange={(e) => set('principal', e.target.value)} />
          </Field>
          <Field label="Date lent" hint={errors.startDate && <span className="text-rose-600">{errors.startDate}</span>}>
            <input className="input" type="date" value={f.startDate} onChange={(e) => setStart(e.target.value || today)} />
          </Field>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <div className="mb-3 text-sm font-bold">Interest</div>
          <div className="space-y-4">
            <Field label="Interest type">
              <Segmented
                className="w-full"
                value={f.interestType}
                onChange={(v) => set('interestType', v)}
                options={[
                  { value: 'monthly', label: 'Monthly %' },
                  { value: 'yearly', label: 'Yearly %' },
                  { value: 'fixed', label: 'Fixed ₹' },
                ]}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isFixed ? 'Fixed interest amount (₹)' : `Interest rate (% per ${f.interestType === 'monthly' ? 'month' : 'year'})`} hint={errors.interestRate && <span className="text-rose-600">{errors.interestRate}</span>}>
                <input className="input num" type="number" inputMode="decimal" min="0" step="0.01" value={f.interestRate} onChange={(e) => set('interestRate', e.target.value)} />
              </Field>
              {!isFixed && (
                <Field label="Interest calculation">
                  <Segmented
                    className="w-full"
                    value={f.interestMethod}
                    onChange={(v) => set('interestMethod', v)}
                    options={[
                      { value: 'simple', label: 'Simple' },
                      { value: 'compound', label: 'Compound' },
                    ]}
                  />
                </Field>
              )}
            </div>
            {!isFixed && f.interestMethod === 'compound' && (
              <Field label="Compounding">
                <select className="input" value={f.compounding} onChange={(e) => set('compounding', e.target.value as Compounding)}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half-yearly">Half-yearly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </Field>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Duration (months)">
            <input className="input num" type="number" inputMode="numeric" min="1" step="1" value={f.durationMonths} onChange={(e) => setDuration(e.target.value)} />
          </Field>
          <Field label="Due date" hint={errors.dueDate && <span className="text-rose-600">{errors.dueDate}</span>}>
            <input className="input" type="date" value={f.dueDate} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Payment frequency">
            <select className="input" value={f.paymentFrequency} onChange={(e) => set('paymentFrequency', e.target.value as PaymentFrequency)}>
              {FREQS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Interest calculation end date (optional)"
          hint={errors.interestEndDate ? <span className="text-rose-600">{errors.interestEndDate}</span> : 'Leave empty to accrue interest until today.'}
        >
          <div className="flex gap-2">
            <input className="input" type="date" value={f.interestEndDate} onChange={(e) => set('interestEndDate', e.target.value)} />
            {f.interestEndDate && (
              <button type="button" className="btn-ghost" onClick={() => set('interestEndDate', '')}>
                Clear
              </button>
            )}
          </div>
        </Field>

        <Field label="Notes">
          <textarea className="input min-h-[64px]" placeholder="Purpose, collateral, witness…" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <div className={clsx('rounded-2xl bg-gradient-to-br from-brand-50 to-blue-50 p-4 dark:from-brand-500/10 dark:to-blue-500/10', !preview && 'opacity-60')}>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-brand-700 dark:text-brand-200">
            <Calculator size={16} /> Calculated for the full term
          </div>
          {preview ? (
            <div className="divide-y divide-brand-100 dark:divide-white/5">
              <Row label="Principal" value={formatINR(draft.principal)} />
              <Row
                label={
                  isFixed
                    ? 'Interest (fixed)'
                    : `Interest · ${f.interestRate}% × ${round2(monthsBetween(f.startDate, f.dueDate))} months${f.interestType === 'yearly' ? ' ÷ 12' : ''}`
                }
                value={formatINR(preview.interest, { paise: true })}
                tone="interest"
              />
              <Row label="Total amount due" value={formatINR(preview.total, { paise: true })} strong />
              {f.paymentFrequency !== 'one-time' && <Row label={`${preview.n} instalments of`} value={formatINR(preview.perInstallment, { paise: true })} />}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Enter a principal and a due date after the start date.</p>
          )}
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
