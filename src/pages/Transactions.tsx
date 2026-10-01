import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, Download, Filter, ReceiptText, Scale, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TransactionRow } from '../components/Rows';
import { EmptyState, PageHeader, Segmented, StatCard } from '../components/ui/common';
import { CATEGORIES, PAYMENT_METHODS } from '../lib/categories';
import { formatDate, formatMonth } from '../lib/dates';
import { downloadCSV, transactionsRows } from '../lib/export';
import { round2 } from '../lib/finance';
import { formatINR } from '../lib/format';
import { live } from '../lib/reports';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import type { TxType } from '../types';

type Sort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export default function Transactions() {
  const all = useStore((s) => s.transactions);
  const open = useUI((s) => s.open);
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | TxType>((params.get('type') as TxType) || 'all');
  const [category, setCategory] = useState(params.get('category') ?? '');
  const [method, setMethod] = useState('');
  const [month, setMonth] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<Sort>('date-desc');
  const [showFilters, setShowFilters] = useState(false);

  const txs = useMemo(() => live(all), [all]);
  const months = useMemo(() => [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort().reverse(), [txs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = txs.filter((t) => {
      if (type !== 'all' && t.type !== type) return false;
      if (category && t.category !== category) return false;
      if (method && t.paymentMethod !== method) return false;
      if (month && !t.date.startsWith(month)) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (needle) {
        const hay = `${t.description} ${t.category} ${t.notes} ${t.paymentMethod} ${t.amount} ${t.date} ${formatDate(t.date)}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const cmp: Record<Sort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      'date-desc': (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      'date-asc': (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
      'amount-desc': (a, b) => b.amount - a.amount,
      'amount-asc': (a, b) => a.amount - b.amount,
    };
    return list.sort(cmp[sort]);
  }, [txs, q, type, category, method, month, from, to, sort]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) t.type === 'income' ? (income += t.amount) : (expense += t.amount);
    return { income: round2(income), expense: round2(expense), net: round2(income - expense) };
  }, [filtered]);

  // Group by month only when sorted by date; amount sorts are shown flat.
  const groups = useMemo(() => {
    if (!sort.startsWith('date')) return [{ key: 'all', items: filtered, income: totals.income, expense: totals.expense }];
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const k = t.date.slice(0, 7);
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return [...map.entries()].map(([key, items]) => ({
      key,
      items,
      income: round2(items.filter((i) => i.type === 'income').reduce((a, b) => a + b.amount, 0)),
      expense: round2(items.filter((i) => i.type === 'expense').reduce((a, b) => a + b.amount, 0)),
    }));
  }, [filtered, sort, totals]);

  const activeFilters = [category, method, month, from, to].filter(Boolean).length;
  const reset = () => {
    setCategory('');
    setMethod('');
    setMonth('');
    setFrom('');
    setTo('');
    setQ('');
    setType('all');
  };

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={`${filtered.length} of ${txs.length} entries`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => downloadCSV('transactions.csv', transactionsRows(filtered))}>
              <Download size={16} /> <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => open({ kind: 'tx', txType: 'income' })}>
              <ArrowDownLeft size={16} /> In
            </button>
            <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => open({ kind: 'tx', txType: 'expense' })}>
              <ArrowUpRight size={16} /> Out
            </button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard compact label="Income" value={totals.income} icon={ArrowDownLeft} tone="income" />
        <StatCard compact label="Expenses" value={totals.expense} icon={ArrowUpRight} tone="expense" />
        <StatCard compact label="Net" value={totals.net} icon={Scale} tone={totals.net >= 0 ? 'income' : 'expense'} />
      </div>

      <div className="card mb-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Search description, amount, date…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All' },
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
          />
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Amount: high → low</option>
            <option value="amount-asc">Amount: low → high</option>
          </select>
          <button className={clsx('btn-secondary', activeFilters && 'border-brand-400 text-brand-700 dark:text-brand-200')} onClick={() => setShowFilters((s) => !s)}>
            <Filter size={16} /> Filters{activeFilters ? ` (${activeFilters})` : ''}
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 dark:border-white/5 sm:grid-cols-2 lg:grid-cols-5">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
              <option value="">All payment methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <select className="input" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
              <option value="">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" title="From" />
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" title="To" />
            {(activeFilters > 0 || q || type !== 'all') && (
              <button className="btn-ghost justify-start text-rose-600 sm:col-span-2 lg:col-span-5" onClick={reset}>
                <X size={16} /> Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ReceiptText}
            title={txs.length ? 'No matching transactions' : 'No transactions yet'}
            message={txs.length ? 'Try changing your search or filters.' : 'Add your first income or expense.'}
            action={
              txs.length ? (
                <button className="btn-secondary" onClick={reset}>
                  Clear filters
                </button>
              ) : (
                <button className="btn-primary" onClick={() => open({ kind: 'tx', txType: 'expense' })}>
                  Add transaction
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key} className="card overflow-hidden">
              {g.key !== 'all' && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
                  <span className="font-bold">{formatMonth(g.key)}</span>
                  <div className="num flex gap-3 text-xs font-semibold">
                    <span className="text-emerald-600 dark:text-emerald-400">+{formatINR(g.income)}</span>
                    <span className="text-rose-600 dark:text-rose-400">−{formatINR(g.expense)}</span>
                    <span className="text-slate-600 dark:text-slate-300">= {formatINR(round2(g.income - g.expense))}</span>
                  </div>
                </div>
              )}
              <div className="divide-y divide-slate-50 px-2 py-1 dark:divide-white/[0.03]">
                {g.items.map((t) => (
                  <TransactionRow key={t.id} t={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
