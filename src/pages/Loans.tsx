import clsx from 'clsx';
import { CheckCircle2, Download, HandCoins, Hourglass, Percent, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoanCard } from '../components/Rows';
import { EmptyState, PageHeader, StatCard } from '../components/ui/common';
import { todayISO } from '../lib/dates';
import { downloadCSV, loansRows } from '../lib/export';
import { formatINR } from '../lib/format';
import { computeLoan, portfolio } from '../lib/loans';
import { live } from '../lib/reports';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-soon', label: 'Due soon' },
  { value: 'partially-paid', label: 'Partially paid' },
  { value: 'fully-paid', label: 'Fully paid' },
] as const;
type Tab = (typeof TABS)[number]['value'];
type Sort = 'due' | 'outstanding' | 'name' | 'recent';

export default function Loans() {
  const all = useStore((s) => s.loans);
  const open = useUI((s) => s.open);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('status') as Tab) || 'all';
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('due');
  const today = todayISO();

  const items = useMemo(() => live(all).map((loan) => ({ loan, s: computeLoan(loan, today) })), [all, today]);
  const pf = useMemo(() => portfolio(all, today), [all, today]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: items.length, active: 0, overdue: 0, 'due-soon': 0, 'partially-paid': 0, 'fully-paid': 0 };
    for (const { s } of items) {
      if (s.status === 'active' || s.status === 'partially-paid') c.active++;
      if (s.status === 'overdue') c.overdue++;
      if (s.dueSoon) c['due-soon']++;
      if (s.status === 'partially-paid') c['partially-paid']++;
      if (s.status === 'fully-paid') c['fully-paid']++;
    }
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter(({ s }) => {
        if (tab === 'all') return true;
        if (tab === 'active') return s.status === 'active' || s.status === 'partially-paid';
        if (tab === 'due-soon') return s.dueSoon;
        return s.status === tab;
      })
      .filter(({ loan }) => !needle || `${loan.borrowerName} ${loan.phone} ${loan.principal} ${loan.notes}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sort === 'outstanding') return b.s.totalOutstanding - a.s.totalOutstanding;
        if (sort === 'name') return a.loan.borrowerName.localeCompare(b.loan.borrowerName);
        if (sort === 'recent') return b.loan.startDate.localeCompare(a.loan.startDate);
        // due: open loans first by next due date, closed last
        const ad = a.s.status === 'fully-paid' ? '9999' : a.s.nextDueDate ?? a.loan.dueDate;
        const bd = b.s.status === 'fully-paid' ? '9999' : b.s.nextDueDate ?? b.loan.dueDate;
        return ad.localeCompare(bd);
      });
  }, [items, tab, q, sort]);

  return (
    <div>
      <PageHeader
        title="Loans"
        subtitle="Money you have lent to others"
        actions={
          <>
            <button className="btn-secondary" onClick={() => downloadCSV('loans.csv', loansRows(all))}>
              <Download size={16} /> <span className="hidden sm:inline">Export</span>
            </button>
            <button className="btn-primary" onClick={() => open({ kind: 'loan' })}>
              <Plus size={16} /> Add loan
            </button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total lent" value={pf.totalLent} icon={HandCoins} tone="loan" />
        <StatCard label="Total repaid" value={pf.totalRepaid} icon={CheckCircle2} tone="income" />
        <StatCard label="Interest earned" value={pf.interestEarned} icon={Percent} tone="interest" hint={`Pending ${formatINR(pf.interestPending)}`} />
        <StatCard label="Outstanding" value={pf.outstanding} icon={Hourglass} tone="loan" />
      </div>

      <div className="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setParams(t.value === 'all' ? {} : { status: t.value })}
            className={clsx('chip shrink-0', tab === t.value ? 'chip-on' : 'chip-off')}
          >
            {t.label}
            <span className={clsx('rounded-full px-1.5 text-[10px]', tab === t.value ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-white/10')}>{counts[t.value]}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search borrower, phone, amount…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort loans">
          <option value="due">Next due</option>
          <option value="outstanding">Outstanding</option>
          <option value="recent">Newest</option>
          <option value="name">Name</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={HandCoins}
            title={items.length ? 'No loans match' : 'No loans yet'}
            message={items.length ? 'Try another filter.' : 'Record money you lend and Paisa Ledger will track interest and repayments for you.'}
            action={
              !items.length && (
                <button className="btn-primary" onClick={() => open({ kind: 'loan' })}>
                  <Plus size={16} /> Add your first loan
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ loan, s }) => (
            <LoanCard key={loan.id} loan={loan} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
