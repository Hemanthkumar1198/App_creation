import clsx from 'clsx';
import { CheckCircle2, Download, FileUp, HandCoins, Hourglass, LayoutGrid, List, Pencil, Percent, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoanCard } from '../components/Rows';
import { EmptyState, PageHeader, Segmented, StatCard, StatusBadge } from '../components/ui/common';
import { formatDate, relativeDays, todayISO } from '../lib/dates';
import { downloadCSV, loansRows } from '../lib/export';
import { formatINR } from '../lib/format';
import { computeLoan, describeRate, portfolio } from '../lib/loans';
import { live } from '../lib/reports';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-soon', label: 'Due soon' },
  { value: 'partially-paid', label: 'Partially paid' },
  { value: 'fully-paid', label: 'Fully repaid' },
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
  const [view, setView] = useState<'list' | 'cards'>(() => {
    try {
      return (localStorage.getItem('paisa-ledger:loan-view') as 'list' | 'cards') || 'list';
    } catch {
      return 'list';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('paisa-ledger:loan-view', view);
    } catch {
      /* ignore */
    }
  }, [view]);
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

  const upcoming = useMemo(
    () =>
      items
        .filter(({ s }) => s.status !== 'fully-paid' && s.nextDueDate)
        .sort((a, b) => a.s.nextDueDate!.localeCompare(b.s.nextDueDate!))
        .slice(0, 5),
    [items],
  );

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
        title="Interest Calculation"
        subtitle="Money you lent on interest: amounts, interest received and pending, per person. Kept separate from daily expenses."
        actions={
          <>
            <Link to="/import" className="btn-secondary">
              <FileUp size={16} /> <span className="hidden sm:inline">Import</span>
            </Link>
            <button className="btn-secondary" onClick={() => downloadCSV('loans.csv', loansRows(all))}>
              <Download size={16} /> <span className="hidden sm:inline">Export</span>
            </button>
            <button className="btn-primary" onClick={() => open({ kind: 'loan' })}>
              <Plus size={16} /> Add interest record
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

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-3 gap-3 lg:col-span-1 lg:grid-cols-1">
          {[
            { label: 'Active loans', n: counts.active, cls: 'text-blue-600 dark:text-blue-300', tab: 'active' as Tab },
            { label: 'Overdue', n: counts.overdue, cls: 'text-rose-600 dark:text-rose-400', tab: 'overdue' as Tab },
            { label: 'Fully repaid', n: counts['fully-paid'], cls: 'text-emerald-600 dark:text-emerald-400', tab: 'fully-paid' as Tab },
          ].map((c) => (
            <button key={c.label} className="card flex flex-col items-start p-3.5 text-left transition hover:shadow-lg lg:flex-row lg:items-center lg:justify-between" onClick={() => setParams({ status: c.tab })}>
              <span className="text-xs text-slate-500 dark:text-slate-400">{c.label}</span>
              <span className={`text-2xl font-extrabold ${c.cls}`}>{c.n}</span>
            </button>
          ))}
        </div>
        <div className="card card-pad lg:col-span-2">
          <h2 className="mb-2 text-base font-bold">Upcoming due dates</h2>
          {upcoming.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">No upcoming due dates.</p>
          ) : (
            <div className="-mx-2 divide-y divide-slate-100 dark:divide-white/5">
              {upcoming.map(({ loan, s }) => (
                <Link key={loan.id} to={`/loans/${loan.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{loan.borrowerName}</div>
                    <div className={clsx('text-xs', s.status === 'overdue' || s.installmentMissed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400')}>
                      {formatDate(s.nextDueDate)} · {relativeDays(s.nextDueDate!, today)}
                    </div>
                  </div>
                  <span className="num text-sm font-bold text-violet-600 dark:text-violet-300">{formatINR(s.totalOutstanding)}</span>
                  <StatusBadge status={s.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
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
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">All borrowers ({shown.length})</h2>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: <span className="flex items-center gap-1.5"><List size={14} /> List</span> },
                { value: 'cards', label: <span className="flex items-center gap-1.5"><LayoutGrid size={14} /> Cards</span> },
              ]}
            />
          </div>
          {view === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map(({ loan, s }) => (
                <LoanCard key={loan.id} loan={loan} s={s} />
              ))}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="num w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
                      <th className="px-4 py-3">Borrower</th>
                      <th className="px-3 py-3 text-right">Lent</th>
                      <th className="px-3 py-3">Last interest</th>
                      <th className="px-3 py-3">Next interest due</th>
                      <th className="px-3 py-3 text-right">Interest due</th>
                      <th className="px-3 py-3 text-right">Outstanding</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                    {shown.map(({ loan, s }) => {
                      const closed = s.status === 'fully-paid';
                      const canInterest = !closed && loan.interestType !== 'fixed' && loan.interestRate > 0;
                      return (
                        <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="px-4 py-3">
                            <Link to={`/loans/${loan.id}`} className="font-semibold hover:text-brand-600 dark:hover:text-brand-300">
                              {loan.borrowerName}
                            </Link>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{loan.phone || 'No phone'} · since {formatDate(loan.startDate)}</div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="font-semibold">{formatINR(s.principal)}</div>
                            <div className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{describeRate(loan)}</div>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {s.lastInterestPayment ? (
                              <>
                                <div className="font-semibold text-sky-600 dark:text-sky-300">{formatINR(s.lastInterestPayment.amount)}</div>
                                <div className="text-slate-500 dark:text-slate-400">{formatDate(s.lastInterestPayment.date)}</div>
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className={clsx('px-3 py-3 text-xs', s.nextInterestDueDate && s.nextInterestDueDate < today ? 'font-semibold text-rose-600 dark:text-rose-400' : '')}>
                            {s.nextInterestDueDate ? (
                              <>
                                <div>{formatDate(s.nextInterestDueDate)}</div>
                                <div className="text-slate-500 dark:text-slate-400">{relativeDays(s.nextInterestDueDate, today)}</div>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-sky-600 dark:text-sky-300">{formatINR(s.remainingInterest)}</td>
                          <td className="px-3 py-3 text-right font-bold text-violet-600 dark:text-violet-300">{formatINR(s.totalOutstanding)}</td>
                          <td className="px-3 py-3">
                            <StatusBadge status={s.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {canInterest && (
                                <button className="btn-ghost px-2 py-1.5 text-xs text-sky-700 dark:text-sky-300" onClick={() => open({ kind: 'interest', loanId: loan.id })} title="Receive interest">
                                  <Percent size={14} /> Interest
                                </button>
                              )}
                              {!closed && (
                                <button className="btn-ghost px-2 py-1.5 text-xs text-emerald-700 dark:text-emerald-300" onClick={() => open({ kind: 'repayment', loanId: loan.id })} title="Add repayment">
                                  <Plus size={14} /> Repay
                                </button>
                              )}
                              <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => open({ kind: 'loan', editId: loan.id })} title="Edit loan">
                                <Pencil size={14} /> Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <button className="btn-primary mt-4 w-full sm:w-auto" onClick={() => open({ kind: 'loan' })}>
            <Plus size={16} /> Add another person
          </button>
        </>
      )}
    </div>
  );
}
