import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  HandCoins,
  Hourglass,
  Landmark,
  Percent,
  Plus,
  ReceiptText,
  TrendingUp,
  CalendarDays,
  FileUp,
  Sparkles,
  NotebookPen,
  AlertCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CategoryBars, IncomeExpenseChart, TrendArea } from '../components/charts/Charts';
import { TransactionRow } from '../components/Rows';
import { EmptyState, SectionTitle, StatCard, StatusBadge } from '../components/ui/common';
import { endOfMonth, formatDate, formatMonth, relativeDays, startOfMonth, todayISO } from '../lib/dates';
import { formatINR } from '../lib/format';
import { computeLoan, portfolio } from '../lib/loans';
import { computePlan, noteTotals } from '../lib/plans';
import { categoryBreakdown, live, personalBalance, trailingPeriods, txTotals } from '../lib/reports';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { useSave } from '../lib/useSave';

/** Shortcuts to the separate trackers: calculation notes and investments & insurance. */
function OtherTrackers() {
  const notes = useStore((s) => s.notes);
  const plans = useStore((s) => s.plans);
  const today = todayISO();
  const n = useMemo(() => notes.filter((x) => !x.deletedAt).map((x) => ({ x, t: noteTotals(x) })), [notes]);
  const p = useMemo(() => plans.filter((x) => !x.deletedAt).map((x) => ({ x, s: computePlan(x, today) })), [plans, today]);
  const due = p.filter(({ s }) => s.daysToDue !== null && s.daysToDue <= 7);
  return (
    <section className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      <Link to="/notes" className="card card-pad flex items-center gap-3 transition hover:shadow-lg">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <NotebookPen size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Calculation Notes</div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
            {n.length ? n.slice(0, 3).map(({ x, t }) => `${x.name}: ${formatINR(t.spent)}`).join(' · ') : 'Separate calculations, e.g. paddy harvest'}
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-400" />
      </Link>
      <Link to="/investments" className="card card-pad flex items-center gap-3 transition hover:shadow-lg">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
          <TrendingUp size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Investments & Insurance</div>
          <div className={`truncate text-xs ${due.length ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {p.length
              ? due.length
                ? `${due.length} payment${due.length > 1 ? 's' : ''} due this week`
                : `${p.length} plans · paid ${formatINR(p.reduce((a, { s }) => a + s.paidThisYear, 0))} this year`
              : 'Track SIP, LIC, term insurance'}
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-400" />
      </Link>
    </section>
  );
}

/** All-time Cash In and Cash Out, kept in two separate columns with month-by-month totals. */
function AllCashInOut({
  history,
  totals,
  counts,
}: {
  history: [string, { income: number; expense: number; inCount: number; outCount: number }][];
  totals: { income: number; expense: number };
  counts: { in: number; out: number };
}) {
  const [showAll, setShowAll] = useState(false);
  const cols = [
    { key: 'in' as const, title: 'All Cash In', total: totals.income, count: counts.in, field: 'income' as const, cnt: 'inCount' as const, tone: 'text-emerald-600 dark:text-emerald-400', icon: ArrowDownLeft, iconCls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', sign: '+', link: '/transactions?book=in', allLink: '/transactions?view=all&type=income', q: '?book=in' },
    { key: 'out' as const, title: 'All Cash Out', total: totals.expense, count: counts.out, field: 'expense' as const, cnt: 'outCount' as const, tone: 'text-rose-600 dark:text-rose-400', icon: ArrowUpRight, iconCls: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', sign: '−', link: '/transactions', allLink: '/transactions?view=all&type=expense', q: '' },
  ];
  return (
    <section>
      <SectionTitle title="All Cash In & Cash Out" subtitle="All-time totals and every month, kept separate" />
      <div className="grid gap-4 lg:grid-cols-2">
        {cols.map((c) => {
          const rows = history.filter(([, m]) => m[c.cnt] > 0);
          const visible = showAll ? rows : rows.slice(0, 6);
          return (
            <div key={c.key} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-white/5">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${c.iconCls}`}>
                  <c.icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{c.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{c.count} {c.count === 1 ? 'entry' : 'entries'} · all time</div>
                </div>
                <div className={`num text-xl font-extrabold ${c.tone}`}>{formatINR(c.total)}</div>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No entries yet.</p>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                  {visible.map(([ym, m]) => (
                    <Link key={ym} to={`/transactions/month/${ym}${c.q}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                      <span className="flex-1 font-medium">{formatMonth(ym)}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{m[c.cnt]} {m[c.cnt] === 1 ? 'entry' : 'entries'}</span>
                      <span className={`num w-28 text-right font-semibold ${c.tone}`}>
                        {c.sign}
                        {formatINR(Math.round(m[c.field] * 100) / 100)}
                      </span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </Link>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-xs dark:border-white/5">
                {rows.length > 6 ? (
                  <button className="font-semibold text-brand-600 dark:text-brand-300" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show fewer months' : `Show all ${rows.length} months`}
                  </button>
                ) : (
                  <span />
                )}
                <Link to={c.allLink} className="font-semibold text-brand-600 dark:text-brand-300">
                  All {c.key === 'in' ? 'Cash In' : 'Cash Out'} entries →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GettingStarted() {
  const open = useUI((s) => s.open);
  const loadSample = useStore((s) => s.loadSampleData);
  const confirm = useUI((s) => s.confirm);
  const { saving, run } = useSave();
  return (
    <section className="card card-pad">
      <h2 className="text-lg font-bold">Welcome! Let's set up your ledger</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add your first entry, bring in records from Excel/CSV/PDF, or explore with demo data.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => open({ kind: 'tx', txType: 'income' })}>
          <Plus size={16} /> Add income
        </button>
        <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => open({ kind: 'tx', txType: 'expense' })}>
          <Plus size={16} /> Add expense
        </button>
        <Link to="/import" className="btn-secondary">
          <FileUp size={16} /> Import data
        </Link>
        <button
          className="btn-ghost"
          disabled={saving}
          onClick={async () => {
            if (await confirm({ title: 'Load demo data?', message: 'Adds realistic sample transactions and loans so you can try the app. You can erase it later in Settings → Data.', confirmLabel: 'Load demo data' }))
              run(loadSample, 'Demo data loaded');
          }}
        >
          <Sparkles size={16} /> Try demo data
        </button>
      </div>
    </section>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const txs = useStore((s) => s.transactions);
  const loans = useStore((s) => s.loans);
  const name = useStore((s) => s.settings.userName);
  const open = useUI((s) => s.open);
  const today = todayISO();

  const data = useMemo(() => {
    const liveTx = live(txs);
    const liveLoans = live(loans);
    const overall = personalBalance(liveTx, today);
    const month = txTotals(liveTx, startOfMonth(today), endOfMonth(today));
    const pf = portfolio(liveLoans, today);
    const months = trailingPeriods('monthly', today, 6);
    const chart = months.map((p) => {
      const t = txTotals(liveTx, p.start, p.end);
      return { label: p.short, income: t.income, expense: t.expense };
    });
    const summaries = liveLoans.map((l) => ({ loan: l, s: computeLoan(l, today) }));
    const upcoming = summaries
      .filter(({ s }) => s.status !== 'fully-paid' && s.nextDueDate)
      .sort((a, b) => (a.s.nextDueDate! < b.s.nextDueDate! ? -1 : 1))
      .slice(0, 5);
    const repayments = liveLoans
      .flatMap((l) => l.repayments.map((r) => ({ r, loan: l })))
      .sort((a, b) => b.r.date.localeCompare(a.r.date) || b.r.createdAt.localeCompare(a.r.createdAt))
      .slice(0, 5);
    const recent = [...liveTx].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    const cats = categoryBreakdown(liveTx, 'expense', startOfMonth(today), endOfMonth(today));
    const thisYm = today.slice(0, 7);
    const monthIn = liveTx.filter((t) => t.type === 'income' && t.date.startsWith(thisYm)).length;
    const monthOut = liveTx.filter((t) => t.type === 'expense' && t.date.startsWith(thisYm)).length;
    // All-time history, month by month — Cash In and Cash Out kept apart.
    const byMonth = new Map<string, { income: number; expense: number; inCount: number; outCount: number }>();
    for (const t of liveTx) {
      const k = t.date.slice(0, 7);
      const m = byMonth.get(k) ?? { income: 0, expense: 0, inCount: 0, outCount: 0 };
      if (t.type === 'income') {
        m.income += t.amount;
        m.inCount++;
      } else {
        m.expense += t.amount;
        m.outCount++;
      }
      byMonth.set(k, m);
    }
    const history = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    const counts = { in: liveTx.filter((t) => t.type === 'income').length, out: liveTx.filter((t) => t.type === 'expense').length };
    return { overall, month, pf, chart, upcoming, repayments, recent, cats, monthIn, monthOut, history, counts };
  }, [txs, loans, today]);

  const { overall, month, pf } = data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{formatDate(today)}</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {greeting()}
          {name ? `, ${name.split(' ')[0]}` : ''} 👋
        </h1>
      </div>

      {/* Hero balance + quick actions */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-blue-600 p-5 text-white shadow-glow sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/85">
              <CalendarDays size={16} /> This month · {formatMonth(today)}
            </div>
            <p className="mt-0.5 text-xs text-white/70">Cash In and Cash Out are shown separately (not added together)</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link to={`/transactions/month/${today.slice(0, 7)}?book=in`} className="rounded-2xl bg-emerald-400/20 p-3.5 ring-1 ring-emerald-200/40 backdrop-blur transition hover:bg-emerald-400/30 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-100">
                  <ArrowDownLeft size={15} /> Cash In
                </div>
                <div className="num mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{formatINR(month.income)}</div>
                <div className="mt-0.5 text-xs text-white/75">{data.monthIn} {data.monthIn === 1 ? 'entry' : 'entries'} →</div>
              </Link>
              <Link to={`/transactions/month/${today.slice(0, 7)}`} className="rounded-2xl bg-rose-400/20 p-3.5 ring-1 ring-rose-200/40 backdrop-blur transition hover:bg-rose-400/30 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-100">
                  <ArrowUpRight size={15} /> Cash Out
                </div>
                <div className="num mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{formatINR(month.expense)}</div>
                <div className="mt-0.5 text-xs text-white/75">{data.monthOut} {data.monthOut === 1 ? 'entry' : 'entries'} →</div>
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => open({ kind: 'tx', txType: 'income' })}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 text-base font-bold shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-400 active:scale-[0.98]"
            >
              <Plus size={20} strokeWidth={2.5} /> Cash In
            </button>
            <button
              onClick={() => open({ kind: 'tx', txType: 'expense' })}
              className="flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-4 text-base font-bold shadow-lg shadow-rose-900/20 transition hover:bg-rose-400 active:scale-[0.98]"
            >
              <span className="text-xl leading-none">−</span> Cash Out
            </button>
            <button
              onClick={() => open({ kind: 'loan' })}
              className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-base font-bold text-brand-700 shadow-lg transition hover:bg-white/90 active:scale-[0.98]"
            >
              <HandCoins size={20} /> Add Interest Record
            </button>
          </div>
        </div>
      </section>

      {txs.length === 0 && loans.length === 0 && <GettingStarted />}

      {/* Personal vs lending — never mixed */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Money lent (total)" value={pf.totalLent} icon={HandCoins} tone="loan" hint={`${pf.counts.total} loans · not counted as expense`} />
        <StatCard label="Outstanding loans" value={pf.outstanding} icon={Hourglass} tone="loan" hint={`Principal ${formatINR(pf.outstandingPrincipal)} + interest ${formatINR(pf.interestPending)}`} />
      </section>

      <OtherTrackers />

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="card card-pad lg:col-span-3">
          <SectionTitle title="Income vs Expense" subtitle="Last 6 months" action={<Link to="/reports" className="text-xs font-semibold text-brand-600 dark:text-brand-300">Reports →</Link>} />
          <IncomeExpenseChart data={data.chart} />
        </div>
        <div className="card card-pad lg:col-span-2">
          <SectionTitle title="Monthly expenses" subtitle="Last 6 months" />
          <TrendArea data={data.chart.map((d) => ({ label: d.label, value: d.expense }))} series="expense" name="Expenses" height={260} />
        </div>
      </section>

      {/* Loan summary */}
      <section>
        <SectionTitle title="Interest calculation summary" subtitle="Money lent on interest — kept separate from your income & expenses" action={<Link to="/loans" className="text-xs font-semibold text-brand-600 dark:text-brand-300">Interest →</Link>} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="💰 Total Lent" value={pf.totalLent} icon={Landmark} tone="loan" />
          <StatCard label="💵 Total Repaid" value={pf.totalRepaid} icon={CheckCircle2} tone="income" />
          <StatCard label="📈 Interest Earned" value={pf.interestEarned} icon={Percent} tone="interest" />
          <StatCard label="⏳ Outstanding" value={pf.outstanding} icon={Hourglass} tone="loan" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { label: 'Active loans', n: pf.counts.active + pf.counts['partially-paid'], icon: CircleDot, cls: 'text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300', q: 'active' },
            { label: 'Overdue loans', n: pf.counts.overdue, icon: AlertCircle, cls: 'text-rose-600 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300', q: 'overdue' },
            { label: 'Due soon', n: pf.counts.dueSoon, icon: CalendarClock, cls: 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300', q: 'due-soon' },
            { label: 'Fully paid', n: pf.counts['fully-paid'], icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300', q: 'fully-paid' },
          ].map((c) => (
            <Link key={c.label} to={`/loans?status=${c.q}`} className="card flex items-center gap-3 p-3.5 transition hover:shadow-lg">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${c.cls}`}>
                <c.icon size={18} />
              </span>
              <div>
                <div className="text-xl font-extrabold leading-none">{c.n}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming due dates */}
        <div className="card card-pad">
          <SectionTitle title="Upcoming loan due dates" />
          {data.upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing due" message="Loans with upcoming due dates appear here." />
          ) : (
            <div className="-mx-2 divide-y divide-slate-100 dark:divide-white/5">
              {data.upcoming.map(({ loan, s }) => (
                <Link key={loan.id} to={`/loans/${loan.id}`} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
                  <div className="w-12 shrink-0 rounded-xl bg-slate-100 py-1.5 text-center dark:bg-white/5">
                    <div className="text-[10px] font-semibold uppercase text-slate-500">{formatDate(s.nextDueDate).split(' ')[1]}</div>
                    <div className="text-lg font-extrabold leading-none">{formatDate(s.nextDueDate).split(' ')[0]}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{loan.borrowerName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{relativeDays(s.nextDueDate!, today)}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-sm font-bold text-violet-600 dark:text-violet-300">{formatINR(s.totalOutstanding)}</div>
                    <StatusBadge status={s.status} className="mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card card-pad">
          <SectionTitle title="Recent transactions" action={<Link to="/transactions" className="text-xs font-semibold text-brand-600 dark:text-brand-300">See all →</Link>} />
          {data.recent.length === 0 ? (
            <EmptyState icon={ReceiptText} title="No transactions yet" message="Tap Cash In or Cash Out to add your first entry." />
          ) : (
            <div className="-mx-2">
              {data.recent.map((t) => (
                <TransactionRow key={t.id} t={t} />
              ))}
            </div>
          )}
        </div>

        {/* Recent repayments + this month's categories */}
        <div className="min-w-0 space-y-4">
          <div className="card card-pad">
            <SectionTitle title="Recent loan repayments" />
            {data.repayments.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No repayments recorded yet.</p>
            ) : (
              <div className="-mx-2">
                {data.repayments.map(({ r, loan }) => (
                  <Link key={r.id} to={`/loans/${loan.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <ArrowDownLeft size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{loan.borrowerName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(r.date)} · interest {formatINR(r.interestPortion)}
                      </div>
                    </div>
                    <span className="num text-sm font-semibold text-emerald-600 dark:text-emerald-400">+{formatINR(r.amount)}</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="card card-pad">
            <SectionTitle title="Where your money went" subtitle={formatMonth(today)} />
            <CategoryBars data={data.cats} max={4} />
          </div>
        </div>
      </section>
      <AllCashInOut history={data.history} totals={{ income: overall.income, expense: overall.expense }} counts={data.counts} />
    </div>
  );
}
