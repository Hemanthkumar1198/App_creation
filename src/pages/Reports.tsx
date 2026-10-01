import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Hourglass,
  Loader2,
  Percent,
  PiggyBank,
  Undo2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CashFlowChart, CategoryBars, IncomeExpenseChart, SingleSeriesBar, TrendArea } from '../components/charts/Charts';
import { PageHeader, SectionTitle, Segmented, StatCard } from '../components/ui/common';
import { todayISO } from '../lib/dates';
import { downloadCSV, downloadPDF } from '../lib/export';
import { formatINR } from '../lib/format';
import { categoryBreakdown, inRange, live, periodFor, periodReport, shiftAnchor, trailingPeriods, type PeriodKind } from '../lib/reports';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

const TRAIL: Record<PeriodKind, number> = { daily: 14, weekly: 8, monthly: 12, yearly: 5 };
const NOUN: Record<PeriodKind, string> = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' };

export default function Reports() {
  const txsAll = useStore((s) => s.transactions);
  const loansAll = useStore((s) => s.loans);
  const toast = useUI((s) => s.toast);
  const today = todayISO();
  const [kind, setKind] = useState<PeriodKind>('monthly');
  const [anchor, setAnchor] = useState(today);
  const [busy, setBusy] = useState(false);

  const txs = useMemo(() => live(txsAll), [txsAll]);
  const loans = useMemo(() => live(loansAll), [loansAll]);
  const period = periodFor(kind, anchor);
  const isCurrent = period.end >= today && period.start <= today;

  const report = useMemo(() => periodReport(txs, loans, periodFor(kind, anchor), today), [txs, loans, kind, anchor, today]);
  const cats = useMemo(() => categoryBreakdown(txs, 'expense', period.start, period.end), [txs, period.start, period.end]);
  const trend = useMemo(
    () => trailingPeriods(kind, anchor, TRAIL[kind]).map((p) => ({ p, r: periodReport(txs, loans, p, today) })),
    [kind, anchor, txs, loans, today],
  );
  const cashFlow = useMemo(
    () => trailingPeriods('monthly', anchor, 12).map((p) => ({ label: p.short, value: periodReport(txs, loans, p, today).cashFlow })),
    [anchor, txs, loans, today],
  );

  const summary: [string, number][] = [
    ['Total income', report.income],
    ['Total expenses', report.expense],
    ['Net savings', report.savings],
    ['Total lent', report.lent],
    ['Total repaid', report.repaid],
    ['Interest earned', report.interestEarned],
    ['Outstanding loans (end of period)', report.outstanding],
  ];

  const periodTxs = () => txs.filter((t) => inRange(t.date, period.start, period.end));

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ['Paisa Ledger report', `${kind} · ${period.label}`],
      [],
      ['Summary', 'Amount (INR)'],
      ...summary.map(([k, v]) => [k, v.toFixed(2)]),
      [],
      ['Expense category', 'Amount (INR)', 'Share %'],
      ...cats.map((c) => [c.category, c.amount.toFixed(2), c.share.toFixed(1)]),
      [],
      [`Trend (last ${TRAIL[kind]} ${NOUN[kind]})`, 'Income', 'Expenses', 'Net savings', 'Lent', 'Repaid', 'Interest earned', 'Outstanding'],
      ...trend.map(({ p, r }) => [p.label, r.income.toFixed(2), r.expense.toFixed(2), r.savings.toFixed(2), r.lent.toFixed(2), r.repaid.toFixed(2), r.interestEarned.toFixed(2), r.outstanding.toFixed(2)]),
      [],
      ['Date', 'Type', 'Category', 'Description', 'Amount (INR)', 'Payment method', 'Notes'],
      ...periodTxs()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => [t.date, t.type, t.category, t.description, t.amount.toFixed(2), t.paymentMethod, t.notes]),
    ];
    downloadCSV(`report-${kind}-${period.start}.csv`, rows);
    toast('CSV exported — opens in Excel');
  };

  const exportPDF = async () => {
    setBusy(true);
    try {
      await downloadPDF({ title: `${kind[0].toUpperCase()}${kind.slice(1)} report`, periodLabel: period.label, summary, categories: cats, transactions: periodTxs(), loans });
      toast('PDF downloaded');
    } catch {
      toast('Could not create PDF', { tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Income, expenses and loans over time"
        actions={
          <>
            <button className="btn-secondary" onClick={exportCSV}>
              <FileSpreadsheet size={16} /> Excel / CSV
            </button>
            <button className="btn-primary" onClick={exportPDF} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} PDF
            </button>
          </>
        }
      />

      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <Segmented
          className="w-full sm:w-auto"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setAnchor(today);
          }}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
        />
        <div className="flex items-center justify-between gap-2">
          <button className="btn-ghost px-2.5" onClick={() => setAnchor(shiftAnchor(kind, anchor, -1))} aria-label="Previous period">
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-[170px] text-center">
            <div className="font-bold">{period.label}</div>
            {!isCurrent && (
              <button className="text-xs font-semibold text-brand-600 dark:text-brand-300" onClick={() => setAnchor(today)}>
                Jump to current
              </button>
            )}
          </div>
          <button className="btn-ghost px-2.5" onClick={() => setAnchor(shiftAnchor(kind, anchor, 1))} aria-label="Next period">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total income" value={report.income} icon={ArrowDownLeft} tone="income" />
        <StatCard label="Total expenses" value={report.expense} icon={ArrowUpRight} tone="expense" />
        <StatCard label="Net savings" value={report.savings} icon={PiggyBank} tone={report.savings >= 0 ? 'income' : 'expense'} hint={report.income ? `${((report.savings / report.income) * 100).toFixed(0)}% of income` : undefined} />
        <StatCard label="Total lent" value={report.lent} icon={HandCoins} tone="loan" />
        <StatCard label="Total repaid" value={report.repaid} icon={Undo2} tone="income" hint={`Principal ${formatINR(report.principalRepaid)}`} />
        <StatCard label="Interest earned" value={report.interestEarned} icon={Percent} tone="interest" />
        <StatCard label="Outstanding loans" value={report.outstanding} icon={Hourglass} tone="loan" hint="As of period end" />
        <StatCard label="Net cash flow" value={report.cashFlow} icon={PiggyBank} tone={report.cashFlow >= 0 ? 'income' : 'expense'} hint="After lending & repayments" />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="card card-pad lg:col-span-3">
          <SectionTitle title="Income vs Expense" subtitle={`Last ${TRAIL[kind]} ${NOUN[kind]}`} />
          <IncomeExpenseChart data={trend.map(({ p, r }) => ({ label: p.short, income: r.income, expense: r.expense }))} />
        </div>
        <div className="card card-pad lg:col-span-2">
          <SectionTitle title="Expense by category" subtitle={period.label} />
          <CategoryBars data={cats} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <SectionTitle title="Loan outstanding" subtitle={`At the end of each of the last ${TRAIL[kind]} ${NOUN[kind]}`} />
          <TrendArea data={trend.map(({ p, r }) => ({ label: p.short, value: r.outstanding }))} series="loan" name="Outstanding" />
        </div>
        <div className="card card-pad">
          <SectionTitle title="Interest earned" subtitle={`Received per ${kind === 'daily' ? 'day' : kind.replace('ly', '')}`} />
          <SingleSeriesBar data={trend.map(({ p, r }) => ({ label: p.short, value: r.interestEarned }))} series="interest" name="Interest earned" />
        </div>
      </section>

      <section className="card card-pad">
        <SectionTitle title="Monthly cash flow" subtitle="Income − expenses − money lent + repayments, last 12 months" />
        <CashFlowChart data={cashFlow} />
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 pt-4 sm:px-5">
          <SectionTitle title="Period breakdown" subtitle="Table view of the charts above" />
        </div>
        <div className="overflow-x-auto">
          <table className="num w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
                <th className="px-4 py-2.5 text-left sm:px-5">Period</th>
                <th className="px-3 py-2.5 text-right">Income</th>
                <th className="px-3 py-2.5 text-right">Expenses</th>
                <th className="px-3 py-2.5 text-right">Savings</th>
                <th className="px-3 py-2.5 text-right">Lent</th>
                <th className="px-3 py-2.5 text-right">Repaid</th>
                <th className="px-3 py-2.5 text-right">Interest</th>
                <th className="px-4 py-2.5 text-right sm:px-5">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
              {[...trend].reverse().map(({ p, r }) => (
                <tr key={p.start} className={p.start === period.start ? 'bg-brand-50/60 dark:bg-brand-500/10' : ''}>
                  <td className="px-4 py-2.5 font-medium sm:px-5">{p.label}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{formatINR(r.income)}</td>
                  <td className="px-3 py-2.5 text-right text-rose-600 dark:text-rose-400">{formatINR(r.expense)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{formatINR(r.savings)}</td>
                  <td className="px-3 py-2.5 text-right">{formatINR(r.lent)}</td>
                  <td className="px-3 py-2.5 text-right">{formatINR(r.repaid)}</td>
                  <td className="px-3 py-2.5 text-right text-sky-600 dark:text-sky-300">{formatINR(r.interestEarned)}</td>
                  <td className="px-4 py-2.5 text-right text-violet-600 dark:text-violet-300 sm:px-5">{formatINR(r.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
