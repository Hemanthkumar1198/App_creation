import clsx from 'clsx';
import {
  ArrowLeft,
  BellRing,
  CalendarRange,
  CheckCircle2,
  Info,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Trash2,
  Percent,
  UserPlus,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, Progress, Row, StatusBadge } from '../components/ui/common';
import { formatDate, relativeDays, todayISO } from '../lib/dates';
import { formatINR } from '../lib/format';
import { computeLoan, describeRate } from '../lib/loans';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { useSave } from '../lib/useSave';

const FREQ_LABEL = { 'one-time': 'One-time', monthly: 'Monthly', quarterly: 'Quarterly', 'half-yearly': 'Half-yearly', yearly: 'Yearly' };

export default function LoanDetail() {
  const { id } = useParams();
  const loan = useStore((s) => s.loans.find((l) => l.id === id));
  const updateLoan = useStore((s) => s.updateLoan);
  const reopenLoan = useStore((s) => s.reopenLoan);
  const deleteLoan = useStore((s) => s.deleteLoan);
  const restoreLoan = useStore((s) => s.restoreLoan);
  const { open, confirm } = useUI();
  const { saving, run } = useSave();
  const navigate = useNavigate();
  const today = todayISO();
  const s = useMemo(() => (loan ? computeLoan(loan, today) : null), [loan, today]);

  if (!loan || !s || loan.deletedAt) {
    return (
      <div className="card">
        <EmptyState icon={Info} title="Loan not found" message="It may have been deleted." action={<Link to="/loans" className="btn-primary">Back to loans</Link>} />
      </div>
    );
  }

  const closed = !!loan.closedAt;
  const hasPrincipalRepay = s.principalRepaid > 0;
  const rateExplain =
    loan.interestType === 'fixed'
      ? `Fixed interest of ${formatINR(loan.interestRate)} for the loan`
      : loan.interestMethod === 'simple' && !hasPrincipalRepay
        ? `${formatINR(loan.principal)} × ${loan.interestRate}% × ${loan.interestType === 'monthly' ? `${s.elapsedMonths} months` : `${s.elapsedMonths} ÷ 12 years`}`
        : loan.interestMethod === 'compound'
          ? `Compounded ${loan.compounding} on outstanding balance for ${s.elapsedMonths} months`
          : `Simple interest on the reducing principal over ${s.elapsedMonths} months`;

  const del = async () => {
    const ok = await confirm({ title: `Delete loan to ${loan.borrowerName}?`, message: 'The loan and its repayment history will be moved to trash. You can restore it from Settings → Trash.', confirmLabel: 'Delete loan', danger: true });
    if (!ok) return;
    if (await run(() => deleteLoan(loan.id), 'Loan moved to trash', { undo: () => void restoreLoan(loan.id) })) navigate('/loans');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to="/loans" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
          <ArrowLeft size={16} /> All interest records
        </Link>
        <button className="btn-primary py-2" onClick={() => open({ kind: 'loan' })}>
          <UserPlus size={16} /> Add another person
        </button>
      </div>

      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-brand-600 to-blue-600 p-5 text-white shadow-glow sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-lg font-extrabold backdrop-blur">
                {loan.borrowerName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">{loan.borrowerName}</h1>
                {loan.phone ? (
                  <a href={`tel:${loan.phone}`} className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
                    <Phone size={13} /> {loan.phone}
                  </a>
                ) : (
                  <span className="text-sm text-white/60">No phone number</span>
                )}
              </div>
            </div>
            <StatusBadge status={s.status} className="bg-white/90 dark:bg-white/90" />
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 sm:items-end">
            <div>
              <div className="text-sm text-white/80">{closed ? 'Loan closed' : 'Total outstanding'}</div>
              <div className="num text-4xl font-extrabold tracking-tight">{formatINR(s.totalOutstanding, { paise: true })}</div>
              {!closed && (
                <div className="mt-1 text-sm text-white/80">
                  Principal {formatINR(s.remainingPrincipal, { paise: true })} + interest {formatINR(s.remainingInterest, { paise: true })}
                </div>
              )}
              {closed && (
                <div className="mt-1 text-sm text-white/80">
                  Marked paid on {formatDate(loan.closedAt)}
                  {s.writtenOff > 0 && ` · ${formatINR(s.writtenOff, { paise: true })} written off`}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-white/80">
                <span>Repaid {formatINR(s.amountRepaid)}</span>
                <span>{s.progress.toFixed(0)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white" style={{ width: `${s.progress}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {!closed && (
              <button className="btn bg-white text-sky-700 hover:bg-white/90" onClick={() => open({ kind: 'interest', loanId: loan.id })}>
                <Percent size={16} /> Receive Interest
              </button>
            )}
            {!closed && (
              <button className="btn bg-white text-brand-700 hover:bg-white/90" onClick={() => open({ kind: 'repayment', loanId: loan.id })}>
                <Plus size={16} /> Add Repayment
              </button>
            )}
            <button className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25" onClick={() => open({ kind: 'loan', editId: loan.id })}>
              <Pencil size={16} /> Edit Loan
            </button>
            {closed ? (
              <button
                className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25"
                onClick={async () => {
                  if (await confirm({ title: 'Reopen this loan?', message: 'The loan will become active again and interest will resume accruing.', confirmLabel: 'Reopen' })) run(() => reopenLoan(loan.id), 'Loan reopened');
                }}
              >
                <RotateCcw size={16} /> Reopen
              </button>
            ) : (
              <button className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25" onClick={() => open({ kind: 'close-loan', loanId: loan.id })}>
                <CheckCircle2 size={16} /> Mark as Fully Repaid
              </button>
            )}
            {!closed && (
              <button className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25" onClick={() => open({ kind: 'reminder', loanId: loan.id })}>
                <BellRing size={16} /> Send Reminder
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Interest accrued */}
        <section className="card card-pad lg:col-span-1">
          <div className="flex items-center gap-2 text-sm font-bold">
            <CalendarRange size={16} className="text-sky-600 dark:text-sky-300" />
            {s.manualEndDate ? `Interest accrued until ${formatDate(s.accrualEndDate)}` : closed ? `Interest accrued until ${formatDate(s.accrualEndDate)}` : 'Interest accrued until today'}
          </div>
          <div className="num mt-2 text-3xl font-extrabold text-sky-600 dark:text-sky-300">{formatINR(s.interestAccrued, { paise: true })}</div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rateExplain}</p>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
            <Row label="Interest received" value={formatINR(s.interestRepaid, { paise: true })} tone="income" />
            <Row label="Interest pending" value={formatINR(s.remainingInterest, { paise: true })} tone="warning" />
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
            <label className="label" htmlFor="end-date">Interest calculation end date</label>
            <div className="flex gap-2">
              <input
                id="end-date"
                type="date"
                className="input"
                min={loan.startDate}
                value={loan.interestEndDate ?? ''}
                disabled={saving}
                onChange={(e) => run(() => updateLoan(loan.id, { interestEndDate: e.target.value || undefined }), 'Interest end date saved')}
              />
              {loan.interestEndDate && (
                <button className="btn-ghost" disabled={saving} onClick={() => run(() => updateLoan(loan.id, { interestEndDate: undefined }), 'Interest now accrues until today')}>
                  Today
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{loan.interestEndDate ? 'Interest stops on this date.' : 'Empty = interest accrues until today.'}</p>
          </div>
        </section>

        {/* Details */}
        <section className="card card-pad lg:col-span-2">
          <h2 className="mb-2 text-base font-bold">Loan details</h2>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              <Row label="Principal" value={formatINR(s.principal, { paise: true })} />
              <Row label="Interest rate" value={describeRate(loan)} />
              <Row label="Start date" value={formatDate(loan.startDate)} />
              <Row label="Due date" value={`${formatDate(loan.dueDate)}`} />
              <Row label="Duration" value={`${loan.durationMonths} months`} />
              <Row label="Payment frequency" value={FREQ_LABEL[loan.paymentFrequency]} />
              <Row
                label="Next due date"
                value={s.nextDueDate ? <span className={clsx(s.installmentMissed || s.status === 'overdue' ? 'text-rose-600 dark:text-rose-400' : '')}>{formatDate(s.nextDueDate)} · {relativeDays(s.nextDueDate, today)}</span> : '—'}
              />
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              <Row label="Total interest (full term)" value={formatINR(s.expectedInterest, { paise: true })} tone="interest" />
              <Row label="Total amount due" value={formatINR(s.totalAmountDue, { paise: true })} strong />
              {loan.paymentFrequency !== 'one-time' && <Row label={`Instalment (${s.installments}×)`} value={formatINR(s.suggestedInstallment, { paise: true })} />}
              <Row label="Amount paid" value={formatINR(s.amountRepaid, { paise: true })} tone="income" />
              <Row label="Principal repaid" value={formatINR(s.principalRepaid, { paise: true })} />
              <Row label="Remaining principal" value={formatINR(s.remainingPrincipal, { paise: true })} />
              <Row label="Remaining amount" value={formatINR(s.totalOutstanding, { paise: true })} tone="loan" strong />
              <Row label="Loan status" value={<StatusBadge status={s.status} />} />
            </div>
          </div>
          {loan.notes && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">{loan.notes}</p>}
        </section>
      </div>

      {/* Interest received */}
      {(
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
            <div>
              <h2 className="text-base font-bold">Interest received</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Each payment starts the next interest period</p>
            </div>
            {!closed && (
              <button className="btn bg-sky-600 py-2 text-white hover:bg-sky-700" onClick={() => open({ kind: 'interest', loanId: loan.id })}>
                <Plus size={15} /> Receive interest
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-3 px-4 sm:grid-cols-3 sm:px-5">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
              <div className="text-xs text-slate-500 dark:text-slate-400">Last received</div>
              <div className="num mt-0.5 font-bold">{s.lastInterestPayment ? formatINR(s.lastInterestPayment.amount, { paise: true }) : '—'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{s.lastInterestPayment ? formatDate(s.lastInterestPayment.date) : 'No interest received yet'}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
              <div className="text-xs text-slate-500 dark:text-slate-400">Next interest due</div>
              <div className={clsx('mt-0.5 font-bold', s.nextInterestDueDate && s.nextInterestDueDate < today ? 'text-rose-600 dark:text-rose-400' : '')}>
                {s.nextInterestDueDate ? formatDate(s.nextInterestDueDate) : '—'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {s.nextInterestDueDate ? relativeDays(s.nextInterestDueDate, today) : ''}
                {s.nextInterestDueDate && s.interestPerPeriod > 0 ? ` · ~${formatINR(s.interestPerPeriod)} per ${s.interestPeriodMonths === 1 ? 'month' : `${s.interestPeriodMonths} months`}` : ''}
              </div>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3 dark:bg-sky-500/10">
              <div className="text-xs text-slate-500 dark:text-slate-400">Interest due now</div>
              {loan.interestRate > 0 ? (
                <div className="num mt-0.5 font-bold text-sky-700 dark:text-sky-300">{formatINR(s.remainingInterest, { paise: true })}</div>
              ) : (
                <button className="mt-0.5 text-left text-sm font-bold text-sky-700 underline dark:text-sky-300" onClick={() => open({ kind: 'loan', editId: loan.id })}>
                  Set interest rate
                </button>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400">Total received {formatINR(s.interestRepaid)}</div>
            </div>
          </div>
          {s.interestPayments.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="num w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
                    <th className="px-4 py-2.5 sm:px-5">Received on</th>
                    <th className="px-3 py-2.5">For period</th>
                    <th className="px-3 py-2.5 text-right">Interest</th>
                    <th className="px-4 py-2.5 sm:px-5">Method · notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                  {[...s.interestPayments].reverse().map((p) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => open({ kind: 'repayment', loanId: loan.id, editId: p.id })}>
                      <td className="px-4 py-2.5 font-medium sm:px-5">{formatDate(p.date)}</td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                        {formatDate(p.periodFrom)} → {formatDate(p.date)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-sky-600 dark:text-sky-300">{formatINR(p.amount, { paise: true })}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 sm:px-5">
                        {p.paymentMethod}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-5 text-sm text-slate-500">No interest received yet. Tap “Receive interest” when {loan.borrowerName.split(' ')[0]} pays.</p>
          )}
          <div className="h-3" />
        </section>
      )}

      {/* Timeline */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          <h2 className="text-base font-bold">Repayment timeline</h2>
          {!closed && (
            <button className="btn-secondary py-2" onClick={() => open({ kind: 'repayment', loanId: loan.id })}>
              <Plus size={15} /> Add
            </button>
          )}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
                <th className="px-4 py-2.5 sm:px-5">Date</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-right">Principal</th>
                <th className="px-3 py-2.5 text-right">Interest</th>
                <th className="px-4 py-2.5 text-right sm:px-5">Balance</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-slate-50 dark:divide-white/[0.03]">
              <tr className="text-slate-500 dark:text-slate-400">
                <td className="px-4 py-3 sm:px-5">
                  <div className="font-medium text-slate-700 dark:text-slate-200">{formatDate(loan.startDate)}</div>
                  <div className="text-xs">Loan given</div>
                </td>
                <td className="px-3 py-3 text-right font-semibold text-violet-600 dark:text-violet-300">{formatINR(loan.principal)}</td>
                <td className="px-3 py-3 text-right">—</td>
                <td className="px-3 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200 sm:px-5">{formatINR(loan.principal)}</td>
              </tr>
              {s.timeline.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => open({ kind: 'repayment', loanId: loan.id, editId: r.id })}>
                  <td className="px-4 py-3 sm:px-5">
                    <div className="font-medium">{formatDate(r.date)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {r.paymentMethod}
                      {r.notes && ` · ${r.notes}`}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatINR(r.amount, { paise: true })}</td>
                  <td className="px-3 py-3 text-right">{formatINR(r.principal, { paise: true })}</td>
                  <td className="px-3 py-3 text-right text-sky-600 dark:text-sky-300">{formatINR(r.interest, { paise: true })}</td>
                  <td className="px-4 py-3 text-right font-semibold sm:px-5">{formatINR(r.balance, { paise: true })}</td>
                </tr>
              ))}
              {!closed && (
                <tr className="bg-violet-50/50 dark:bg-violet-500/5">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="font-medium">{formatDate(s.accrualEndDate)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{s.manualEndDate ? 'Interest end date' : 'Today'} · balance with accrued interest</div>
                  </td>
                  <td className="px-3 py-3 text-right">—</td>
                  <td className="px-3 py-3 text-right">{formatINR(s.remainingPrincipal, { paise: true })}</td>
                  <td className="px-3 py-3 text-right text-sky-600 dark:text-sky-300">{formatINR(s.remainingInterest, { paise: true })}</td>
                  <td className="px-4 py-3 text-right font-bold text-violet-600 dark:text-violet-300 sm:px-5">{formatINR(s.totalOutstanding, { paise: true })}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {s.timeline.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">No repayments yet. Tap “Add Repayment” when {loan.borrowerName.split(' ')[0]} pays you back.</p>}
        <div className="px-4 pb-4 sm:px-5">
          <Progress value={s.progress} className="mt-2" />
        </div>
      </section>

      <div className="flex justify-end">
        <button className="btn-ghost text-rose-600 dark:text-rose-400" onClick={del}>
          <Trash2 size={16} /> Delete loan
        </button>
      </div>
    </div>
  );
}
