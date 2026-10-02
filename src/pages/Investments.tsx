import clsx from 'clsx';
import { CalendarClock, CheckCircle2, ChevronRight, PiggyBank, Plus, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, PageHeader, StatCard } from '../components/ui/common';
import { formatDate, relativeDays, todayISO } from '../lib/dates';
import { sumMoney } from '../lib/finance';
import { formatINR } from '../lib/format';
import { PLAN_FREQ, computePlan, isInsurance } from '../lib/plans';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

/** SIP, LIC, term insurance and other recurring investments / premiums. */
export default function Investments() {
  const plans = useStore((s) => s.plans);
  const open = useUI((s) => s.open);
  const today = todayISO();
  const [filter, setFilter] = useState<'all' | 'invest' | 'insurance'>('all');

  const items = useMemo(() => plans.filter((p) => !p.deletedAt).map((p) => ({ p, s: computePlan(p, today) })), [plans, today]);
  const shown = items
    .filter(({ p }) => filter === 'all' || (filter === 'insurance' ? isInsurance(p.kind) : !isInsurance(p.kind)))
    .sort((a, b) => (a.s.nextDueDate ?? '9999').localeCompare(b.s.nextDueDate ?? '9999'));
  const totals = {
    thisYear: sumMoney(items.map((x) => x.s.paidThisYear)),
    allTime: sumMoney(items.map((x) => x.s.totalPaid)),
    investedAll: sumMoney(items.filter((x) => !isInsurance(x.p.kind)).map((x) => x.s.totalPaid)),
    premiumsAll: sumMoney(items.filter((x) => isInsurance(x.p.kind)).map((x) => x.s.totalPaid)),
    yearly: sumMoney(items.map((x) => x.s.yearlyCommitment)),
  };
  const upcoming = items.filter(({ s }) => s.daysToDue !== null && s.daysToDue <= 30).sort((a, b) => (a.s.nextDueDate ?? '').localeCompare(b.s.nextDueDate ?? ''));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investments & Insurance"
        subtitle="Create as many records as you like (SIP, LIC, term insurance, gold, chit fund, anything) and add entries inside each"
        actions={
          <button className="btn-primary" onClick={() => open({ kind: 'plan' })}>
            <Plus size={16} /> New record
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={`Paid in ${today.slice(0, 4)}`} value={totals.thisYear} icon={Wallet} tone="brand" />
        <StatCard label="Invested (all time)" value={totals.investedAll} icon={TrendingUp} tone="income" hint="SIP, MF, PPF, FD, gold…" />
        <StatCard label="Premiums paid (all time)" value={totals.premiumsAll} icon={ShieldCheck} tone="interest" hint="LIC & insurance" />
        <StatCard label="Yearly commitment" value={totals.yearly} icon={PiggyBank} tone="warning" hint={`≈ ${formatINR(totals.yearly / 12)} per month`} />
      </div>

      {upcoming.length > 0 && (
        <section className="card card-pad">
          <h2 className="mb-2 flex items-center gap-2 font-bold">
            <CalendarClock size={18} className="text-amber-500" /> Due in the next 30 days
          </h2>
          <div className="-mx-2 divide-y divide-slate-100 dark:divide-white/5">
            {upcoming.map(({ p, s }) => (
              <div key={p.id} className="flex items-center gap-3 px-2 py-2.5">
                <Link to={`/investments/${p.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className={clsx('text-xs', s.overdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400')}>
                    {p.kind} · {s.overdue ? 'overdue since' : 'due'} {formatDate(s.nextDueDate)} ({relativeDays(s.nextDueDate!, today)})
                  </div>
                </Link>
                <span className="num text-sm font-bold">{formatINR(p.amount)}</span>
                <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => open({ kind: 'plan-payment', planId: p.id })}>
                  Pay
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        {(
          [
            ['all', `All (${items.length})`],
            ['invest', 'Investments'],
            ['insurance', 'Insurance'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} className={clsx('chip', filter === v ? 'chip-on' : 'chip-off')} onClick={() => setFilter(v)}>
            {l}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={TrendingUp}
            title="Nothing added yet"
            message="Add your SIPs, LIC policy, term insurance and other recurring payments to track every instalment and due date."
            action={
              <button className="btn-primary" onClick={() => open({ kind: 'plan' })}>
                <Plus size={16} /> New record
              </button>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {shown.map(({ p, s }) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', isInsurance(p.kind) ? 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300')}>
                  {isInsurance(p.kind) ? <ShieldCheck size={20} /> : <TrendingUp size={20} />}
                </span>
                <Link to={`/investments/${p.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {p.kind}
                    {p.provider ? ` · ${p.provider}` : ''}
                    {p.amount > 0 ? ` · ${formatINR(p.amount)} ${PLAN_FREQ.find((f) => f.value === p.frequency)?.label.toLowerCase()}` : ` · ${s.payments} entries`}
                  </div>
                  <div className={clsx('text-xs', s.overdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400')}>
                    {s.ended ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    ) : s.nextDueDate ? (
                      `Next due ${formatDate(s.nextDueDate)} · ${relativeDays(s.nextDueDate, today)}`
                    ) : s.lastPayment ? (
                      `Last entry ${formatDate(s.lastPayment.date)}`
                    ) : (
                      'No entries yet'
                    )}
                  </div>
                </Link>
                <div className="hidden text-right sm:block">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Total paid</div>
                  <div className="num font-bold">{formatINR(s.totalPaid)}</div>
                </div>
                <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => open({ kind: 'plan-payment', planId: p.id })}>
                  <Plus size={14} /> Entry
                </button>
                <Link to={`/investments/${p.id}`} aria-label="Open">
                  <ChevronRight size={18} className="text-slate-400" />
                </Link>
              </div>
            ))}
            <button className="flex w-full items-center justify-center gap-2 px-4 py-4 text-sm font-semibold text-brand-600 hover:bg-brand-50/50 dark:text-brand-300 dark:hover:bg-white/5" onClick={() => open({ kind: 'plan' })}>
              <Plus size={16} /> Add another record
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">Tracked separately from your daily income & expenses.</p>
    </div>
  );
}
