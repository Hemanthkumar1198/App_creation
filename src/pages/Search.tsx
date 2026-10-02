import clsx from 'clsx';
import { ArrowDownLeft, Search as SearchIcon, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoanCard, TransactionRow } from '../components/Rows';
import { EmptyState, PageHeader, SectionTitle, StatusBadge } from '../components/ui/common';
import { CATEGORIES, PAYMENT_METHODS } from '../lib/categories';
import { formatDate, formatDateNumeric, todayISO } from '../lib/dates';
import { formatINR } from '../lib/format';
import { computeLoan, STATUS_LABEL } from '../lib/loans';
import { live } from '../lib/reports';
import { useStore } from '../store/useStore';
import type { LoanStatus } from '../types';

type Kind = 'all' | 'income' | 'expense' | 'loans';

function haystack(...parts: (string | number | undefined)[]) {
  return parts.filter((p) => p !== undefined && p !== '').join(' ').toLowerCase();
}

/** Matches text, amounts (₹/commas ignored) and dates (ISO, dd/mm/yyyy, "01 Oct 2026"). */
function matches(q: string, hay: string, amounts: number[]) {
  if (!q) return true;
  const n = q.replace(/[₹,\s]/g, '');
  if (/^\d+(\.\d+)?$/.test(n) && amounts.some((a) => String(a) === n || a.toFixed(2) === Number(n).toFixed(2) || String(Math.round(a)).startsWith(n))) return true;
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = (params.get('q') ?? '').trim();
  const txsAll = useStore((s) => s.transactions);
  const loansAll = useStore((s) => s.loans);
  const today = todayISO();

  const [kind, setKind] = useState<Kind>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'' | LoanStatus>('');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [input, setInput] = useState(q);
  useEffect(() => {
    setInput(q);
  }, [q]);

  const inDate = (d: string) => (!from || d >= from) && (!to || d <= to);

  const txs = useMemo(() => {
    if (kind === 'loans' || status) return [];
    return live(txsAll)
      .filter((t) => (kind === 'all' || t.type === kind) && (!category || t.category === category) && (!method || t.paymentMethod === method) && inDate(t.date))
      .filter((t) => matches(q, haystack(t.description, t.category, t.notes, t.paymentMethod, t.type, t.date, formatDate(t.date), formatDateNumeric(t.date), t.amount), [t.amount]))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [txsAll, q, kind, category, method, from, to, status]);

  const loans = useMemo(() => {
    if (kind === 'income' || kind === 'expense' || category) return [];
    return live(loansAll)
      .map((loan) => ({ loan, s: computeLoan(loan, today) }))
      .filter(({ loan, s }) => (!status || s.status === status) && (inDate(loan.startDate) || loan.repayments.some((r) => inDate(r.date))))
      .filter(({ loan, s }) =>
        matches(
          q,
          haystack(loan.borrowerName, loan.phone, loan.notes, 'loan', STATUS_LABEL[s.status], loan.startDate, loan.dueDate, formatDate(loan.startDate), formatDate(loan.dueDate), formatDateNumeric(loan.startDate), formatDateNumeric(loan.dueDate)),
          [loan.principal, s.totalOutstanding, s.totalAmountDue],
        ),
      );
  }, [loansAll, q, kind, status, category, from, to, today]);

  const repayments = useMemo(() => {
    if (kind === 'income' || kind === 'expense' || category || !q) return [];
    return live(loansAll)
      .flatMap((loan) => loan.repayments.map((r) => ({ loan, r })))
      .filter(({ r }) => inDate(r.date) && (!method || r.paymentMethod === method))
      .filter(({ loan, r }) => matches(q, haystack(loan.borrowerName, 'repayment', r.notes, r.paymentMethod, r.date, formatDate(r.date), formatDateNumeric(r.date)), [r.amount]))
      .sort((a, b) => b.r.date.localeCompare(a.r.date));
  }, [loansAll, q, kind, category, method, from, to]);

  const total = txs.length + loans.length + repayments.length;
  const hasFilters = kind !== 'all' || from || to || status || category || method;

  return (
    <div>
      <PageHeader title="Search" subtitle={q ? `${total} result${total === 1 ? '' : 's'} for “${q}”` : 'Search everything'} />

      <form
        className="relative mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/search?q=${encodeURIComponent(input.trim())}`);
        }}
      >
        <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoFocus className="input rounded-2xl py-3.5 pl-11 text-base" placeholder="Name, category, ₹ amount, date (01/10/2026)…" value={input} onChange={(e) => setInput(e.target.value)} />
      </form>

      <div className="card mb-5 grid gap-2 p-3 sm:grid-cols-3 lg:grid-cols-7">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)} aria-label="Type">
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="loans">Loans & repayments</option>
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as LoanStatus | '')} aria-label="Loan status">
          <option value="">Any loan status</option>
          {(Object.keys(STATUS_LABEL) as LoanStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">Any category</option>
          {CATEGORIES.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
          <option value="">Any payment method</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" title="From" />
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" title="To" />
        <button
          className={clsx('btn-ghost', !hasFilters && 'invisible')}
          onClick={() => {
            setKind('all');
            setFrom('');
            setTo('');
            setStatus('');
            setCategory('');
            setMethod('');
          }}
        >
          <X size={16} /> Reset
        </button>
      </div>

      {total === 0 ? (
        <div className="card">
          <EmptyState icon={SearchIcon} title={q || hasFilters ? 'No results' : 'Start typing to search'} message="Search by person, category, description, amount (e.g. 4500) or date (e.g. 01/10/2026)." />
        </div>
      ) : (
        <div className="space-y-6">
          {loans.length > 0 && (
            <section>
              <SectionTitle title={`People & loans (${loans.length})`} />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {loans.map(({ loan, s }) => (
                  <LoanCard key={loan.id} loan={loan} s={s} />
                ))}
              </div>
            </section>
          )}
          {repayments.length > 0 && (
            <section>
              <SectionTitle title={`Loan repayments (${repayments.length})`} />
              <div className="card divide-y divide-slate-50 px-2 py-1 dark:divide-white/[0.03]">
                {repayments.map(({ loan, r }) => (
                  <Link key={r.id} to={`/loans/${loan.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <ArrowDownLeft size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">Repayment from {loan.borrowerName}</div>
                      <div className="text-xs text-slate-500">
                        {formatDate(r.date)} · {r.paymentMethod}
                      </div>
                    </div>
                    <StatusBadge status={computeLoan(loan, today).status} className="hidden sm:inline-flex" />
                    <span className="num text-sm font-semibold text-emerald-600 dark:text-emerald-400">+{formatINR(r.amount)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {txs.length > 0 && (
            <section>
              <SectionTitle title={`Transactions (${txs.length})`} />
              <div className="card divide-y divide-slate-50 px-2 py-1 dark:divide-white/[0.03]">
                {txs.slice(0, 200).map((t) => (
                  <TransactionRow key={t.id} t={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
