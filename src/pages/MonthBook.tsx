import { ArrowDownLeft, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, ReceiptText } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CategoryBars } from '../components/charts/Charts';
import { TransactionRow } from '../components/Rows';
import { EmptyState, SectionTitle, StatCard } from '../components/ui/common';
import { addMonths, endOfMonth, formatDate, formatMonth, todayISO } from '../lib/dates';
import { downloadCSV, transactionsRows } from '../lib/export';
import { round2 } from '../lib/finance';
import { formatINR } from '../lib/format';
import { categoryBreakdown, live, txTotals } from '../lib/reports';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

/** One month's "book": totals, where the money went, and every entry grouped by day. */
export default function MonthBook() {
  const { ym = todayISO().slice(0, 7) } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kind: 'expense' | 'income' = params.get('book') === 'in' ? 'income' : 'expense';
  const isIn = kind === 'income';
  const all = useStore((s) => s.transactions);
  const open = useUI((s) => s.open);
  const start = `${ym}-01`;
  const end = endOfMonth(start);
  const today = todayISO();

  const data = useMemo(() => {
    const txs = live(all).filter((t) => t.date >= start && t.date <= end);
    const shown = txs.filter((t) => t.type === kind);
    const days = new Map<string, typeof txs>();
    for (const t of [...shown].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))) {
      days.set(t.date, [...(days.get(t.date) ?? []), t]);
    }
    return { txs, shown, totals: txTotals(txs, start, end), cats: categoryBreakdown(txs, kind, start, end), days: [...days.entries()] };
  }, [all, start, end, kind]);

  const go = (delta: number) => navigate(`/transactions/month/${addMonths(start, delta).slice(0, 7)}${isIn ? '?book=in' : ''}`);
  const defaultDate = ym === today.slice(0, 7) ? today : end < today ? end : start;

  return (
    <div className="space-y-5">
      <Link to="/transactions" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft size={16} /> Monthly books
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-2.5" onClick={() => go(-1)} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{formatMonth(ym)}</h1>
          <button className="btn-ghost px-2.5" onClick={() => go(1)} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => downloadCSV(`expenses-${ym}.csv`, transactionsRows(data.txs))}>
            <Download size={16} /> <span className="hidden sm:inline">Export</span>
          </button>
          <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => open({ kind: 'tx', txType: 'income', defaultDate })}>
            <ArrowDownLeft size={16} /> In
          </button>
          <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => open({ kind: 'tx', txType: 'expense', defaultDate })}>
            <ArrowUpRight size={16} /> Out
          </button>
        </div>
      </div>

      {/* Cash In and Cash Out are kept as separate books with separate totals. */}
      <div className="grid grid-cols-2 gap-3">
        <button className={`rounded-2xl text-left ring-2 transition ${!isIn ? 'ring-rose-400' : 'ring-transparent'}`} onClick={() => setParams({}, { replace: true })}>
          <StatCard compact label="Cash Out (spent)" value={data.totals.expense} icon={ArrowUpRight} tone="expense" hint={`${data.txs.filter((t) => t.type === 'expense').length} entries`} />
        </button>
        <button className={`rounded-2xl text-left ring-2 transition ${isIn ? 'ring-emerald-400' : 'ring-transparent'}`} onClick={() => setParams({ book: 'in' }, { replace: true })}>
          <StatCard compact label="Cash In (received)" value={data.totals.income} icon={ArrowDownLeft} tone="income" hint={`${data.txs.filter((t) => t.type === 'income').length} entries`} />
        </button>
      </div>

      {data.shown.length === 0 ? (
        <div className="card">
          <EmptyState icon={ReceiptText} title={`No ${isIn ? 'cash in' : 'expenses'} in ${formatMonth(ym)}`} message={`Add ${isIn ? 'money received' : 'money spent'} for this month.`} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            {data.days.map(([day, items]) => {
              const spent = round2(items.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0));
              const got = round2(items.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0));
              return (
                <div key={day} className="card overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-sm dark:border-white/5 dark:bg-white/[0.02]">
                    <span className="font-bold">{formatDate(day)}</span>
                    <span className="num flex gap-3 text-xs font-semibold">
                      {got > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{formatINR(got)}</span>}
                      {spent > 0 && <span className="text-rose-600 dark:text-rose-400">−{formatINR(spent)}</span>}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50 px-2 py-1 dark:divide-white/[0.03]">
                    {items.map((t) => (
                      <TransactionRow key={t.id} t={t} showDate={false} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="lg:col-span-2">
            <div className="card card-pad lg:sticky lg:top-20">
              <SectionTitle title={isIn ? 'Where the money came from' : 'Where the money went'} subtitle={`${data.shown.length} ${isIn ? 'cash in' : 'expense'} entries`} />
              <CategoryBars data={data.cats} max={8} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
