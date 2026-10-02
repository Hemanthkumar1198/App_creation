import clsx from 'clsx';
import { ArrowLeft, Info, Pencil, Plus, ShieldCheck, Trash2, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, Row } from '../components/ui/common';
import { formatDate, formatMonth, relativeDays, todayISO } from '../lib/dates';
import { formatINR } from '../lib/format';
import { PLAN_FREQ, computePlan, isInsurance } from '../lib/plans';
import { useSave } from '../lib/useSave';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

export default function PlanDetail() {
  const { id } = useParams();
  const plan = useStore((s) => s.plans.find((p) => p.id === id));
  const deletePlan = useStore((s) => s.deletePlan);
  const restorePlan = useStore((s) => s.restorePlan);
  const { open, confirm } = useUI();
  const { run } = useSave();
  const navigate = useNavigate();
  const today = todayISO();
  const s = useMemo(() => (plan ? computePlan(plan, today) : null), [plan, today]);

  if (!plan || !s || plan.deletedAt) {
    return (
      <div className="card">
        <EmptyState icon={Info} title="Not found" message="It may have been moved to Trash (Settings → Trash)." action={<Link to="/investments" className="btn-primary">All plans</Link>} />
      </div>
    );
  }
  const ins = isInsurance(plan.kind);
  const payments = [...plan.payments].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const months = [...payments.reduce((m, p) => m.set(p.date.slice(0, 7), [...(m.get(p.date.slice(0, 7)) ?? []), p]), new Map<string, typeof payments>())];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to="/investments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
          <ArrowLeft size={16} /> All records
        </Link>
        <button className="btn-primary py-2" onClick={() => open({ kind: 'plan' })}>
          <Plus size={16} /> New record
        </button>
      </div>
      <section className={clsx('rounded-3xl p-5 text-white shadow-lg sm:p-7', ins ? 'bg-gradient-to-br from-sky-600 to-blue-700' : 'bg-gradient-to-br from-emerald-600 to-teal-700')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15">{ins ? <ShieldCheck size={22} /> : <TrendingUp size={22} />}</span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{plan.name}</h1>
              <p className="text-sm text-white/85">
                {plan.kind}
                {plan.provider ? ` · ${plan.provider}` : ''}
              </p>
            </div>
          </div>
          <button className="btn bg-white/15 py-2 text-white hover:bg-white/25" onClick={() => open({ kind: 'plan', editId: plan.id })}>
            <Pencil size={15} /> Edit
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ['Total paid', formatINR(s.totalPaid)],
            [`Paid in ${today.slice(0, 4)}`, formatINR(s.paidThisYear)],
            [s.nextDueDate || s.ended ? 'Next due' : 'Entries', s.ended ? 'Completed' : s.nextDueDate ? formatDate(s.nextDueDate) : String(s.payments)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-white/15 p-3">
              <div className="text-xs text-white/85">{l}</div>
              <div className="num mt-0.5 font-extrabold sm:text-xl">{v}</div>
            </div>
          ))}
        </div>
        <button className="btn mt-5 bg-white text-slate-900 hover:bg-white/90" onClick={() => open({ kind: 'plan-payment', planId: plan.id })}>
          <Plus size={16} /> Add entry
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card card-pad lg:col-span-2">
          <h2 className="mb-2 font-bold">Details</h2>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            <Row label={ins ? 'Premium' : 'Instalment'} value={plan.amount > 0 ? `${formatINR(plan.amount)} · ${PLAN_FREQ.find((f) => f.value === plan.frequency)?.label}` : 'Varies (free entries)'} />
            <Row label="Started" value={formatDate(plan.startDate)} />
            <Row label={ins ? 'Policy end / maturity' : 'End date'} value={plan.endDate ? formatDate(plan.endDate) : '—'} />
            {plan.policyNumber && <Row label={ins ? 'Policy no.' : 'Folio / account'} value={plan.policyNumber} />}
            {plan.coverAmount ? <Row label={ins ? 'Sum assured / cover' : 'Target'} value={formatINR(plan.coverAmount)} /> : null}
            <Row label="Payments made" value={s.payments} />
            <Row label="Last paid" value={s.lastPayment ? `${formatINR(s.lastPayment.amount)} on ${formatDate(s.lastPayment.date)}` : '—'} />
            <Row
              label="Next due"
              value={s.nextDueDate ? <span className={s.overdue ? 'text-rose-600 dark:text-rose-400' : ''}>{`${formatDate(s.nextDueDate)} · ${relativeDays(s.nextDueDate, today)}`}</span> : '—'}
            />
            <Row label="Yearly commitment" value={formatINR(s.yearlyCommitment)} />
          </div>
          {plan.notes && <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5">{plan.notes}</p>}
        </section>
        <section className="card order-first overflow-hidden lg:order-none lg:col-span-3">
          <h2 className="px-4 pt-4 font-bold sm:px-5">Entries ({payments.length})</h2>
          {payments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No entries yet. Tap “Add entry”.</p>
          ) : (
            <div className="mt-2">
              {months.map(([ym, list]) => (
                <div key={ym}>
                  <div className="flex items-center justify-between border-y border-slate-100 bg-slate-50/70 px-4 py-2 text-xs font-semibold dark:border-white/5 dark:bg-white/[0.02] sm:px-5">
                    <span>{formatMonth(ym)}</span>
                    <span className="num">{formatINR(list.reduce((a, x) => a + x.amount, 0))}</span>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                    {list.map((p) => (
                      <button key={p.id} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 sm:px-5" onClick={() => open({ kind: 'plan-payment', planId: plan.id, editId: p.id })}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{p.description || plan.name}</div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(p.date)} · {p.paymentMethod}
                            {p.notes ? ` · ${p.notes}` : ''}
                          </div>
                        </div>
                        <span className="num font-semibold">{formatINR(p.amount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="flex justify-end">
        <button
          className="btn-ghost text-rose-600 dark:text-rose-400"
          onClick={async () => {
            if (await confirm({ title: `Move "${plan.name}" to Trash?`, message: 'Its payment history is kept. You can restore it any time from Settings → Trash.', confirmLabel: 'Move to Trash', danger: true }))
              if (await run(() => deletePlan(plan.id), 'Moved to Trash', { undo: () => void restorePlan(plan.id) })) navigate('/investments');
          }}
        >
          <Trash2 size={16} /> Move to Trash
        </button>
      </div>
    </div>
  );
}
