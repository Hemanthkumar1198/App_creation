import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  HandCoins,
  Hourglass,
  Landmark,
  Percent,
  Plus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CategoryBars, IncomeExpenseChart, TrendArea } from '../components/charts/Charts';
import { TransactionRow } from '../components/Rows';
import { EmptyState, SectionTitle, StatCard, StatusBadge } from '../components/ui/common';
import { endOfMonth, formatDate, formatMonth, relativeDays, startOfMonth, todayISO } from '../lib/dates';
import { formatINR } from '../lib/format';
import { computeLoan, portfolio } from '../lib/loans';
import { categoryBreakdown, live, overallBalance, trailingPeriods, txTotals } from '../lib/reports';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

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
    const overall = overallBalance(liveTx, liveLoans, today);
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
    return { overall, month, pf, chart, upcoming, repayments, recent, cats };
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
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Wallet size={16} /> Current balance
            </div>
            <div className="num mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatINR(overall.balance)}</div>
            <p className="mt-1 text-xs text-white/70">Income − expenses − money lent + repayments received</p>
            <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                <div className="flex items-center gap-1.5 text-xs text-white/80">
                  <TrendingUp size={14} /> Total income
                </div>
                <div className="num mt-0.5 font-bold">{formatINR(overall.income)}</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                <div className="flex items-center gap-1.5 text-xs text-white/80">
                  <TrendingDown size={14} /> Total expenses
                </div>
                <div className="num mt-0.5 font-bold">{formatINR(overall.expense)}</div>
              </div>
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
              <HandCoins size={20} /> Add Loan
            </button>
          </div>
        </div>
      </section>

      {/* Key stats */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="This month's income" value={month.income} icon={ArrowDownLeft} tone="income" hint={formatMonth(today)} />
        <StatCard label="This month's expenses" value={month.expense} icon={ArrowUpRight} tone="expense" hint={`Net ${formatINR(month.net)}`} />
        <StatCard label="Total money lent" value={pf.totalLent} icon={HandCoins} tone="loan" hint={`${pf.counts.total} loans`} />
        <StatCard label="Loan outstanding" value={pf.outstanding} icon={Hourglass} tone="loan" hint={`Principal ${formatINR(pf.outstandingPrincipal)}`} />
        <StatCard label="Interest earned" value={pf.interestEarned} icon={Percent} tone="interest" hint="Received so far" />
        <StatCard label="Interest pending" value={pf.interestPending} icon={Clock} tone="warning" hint="Accrued until today" />
        <StatCard label="Total income" value={overall.income} icon={TrendingUp} tone="income" hint="All time" />
        <StatCard label="Total expenses" value={overall.expense} icon={TrendingDown} tone="expense" hint="All time" />
      </section>

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
        <SectionTitle title="Loan summary" action={<Link to="/loans" className="text-xs font-semibold text-brand-600 dark:text-brand-300">All loans →</Link>} />
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
    </div>
  );
}
