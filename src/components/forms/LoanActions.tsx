import { Copy, Loader2, MessageCircle, MessageSquareText, Phone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Field, Row } from '../ui/common';
import { PAYMENT_METHODS } from '../../lib/categories';
import { formatDate, todayISO } from '../../lib/dates';
import { formatINR } from '../../lib/format';
import { computeLoan, suggestRepaymentSplit } from '../../lib/loans';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import { useSave } from '../../lib/useSave';
import type { PaymentMethod } from '../../types';

/** "Mark as Paid": optionally records the settlement payment, then closes the loan. */
export function CloseLoanForm({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const loan = useStore((s) => s.loans.find((l) => l.id === loanId));
  const closeLoan = useStore((s) => s.closeLoan);
  const lastMethod = useStore((s) => s.settings.lastPaymentMethod);
  const { saving, run } = useSave();
  const [date, setDate] = useState(todayISO());
  const [record, setRecord] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>(lastMethod);
  const due = useMemo(() => (loan ? suggestRepaymentSplit(loan, Number.MAX_SAFE_INTEGER, date) : null), [loan, date]);
  if (!loan || !due) return null;

  const save = async () => {
    const ok = await run(() => closeLoan(
      loan.id,
      date,
      record && due.outstanding > 0
        ? { amount: due.outstanding, date, paymentMethod: method, principalPortion: due.principalDue, interestPortion: due.interestDue, notes: 'Final settlement' }
        : undefined,
    ), `Loan to ${loan.borrowerName} marked as fully repaid`);
    if (ok) onClose();
  };

  return (
    <Sheet
      title="Mark as paid"
      subtitle={loan.borrowerName}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn flex-1 bg-emerald-600 text-white hover:bg-emerald-700" onClick={save} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />} Mark as paid
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Settlement date">
          <input type="date" className="input" value={date} min={loan.startDate} onChange={(e) => setDate(e.target.value || todayISO())} />
        </Field>
        <div className="rounded-2xl bg-slate-50 px-4 py-1 dark:bg-white/5">
          <Row label="Principal outstanding" value={formatINR(due.principalDue, { paise: true })} />
          <Row label={`Interest until ${formatDate(date)}`} value={formatINR(due.interestDue, { paise: true })} tone="interest" />
          <Row label="Settlement amount" value={formatINR(due.outstanding, { paise: true })} strong />
        </div>
        {due.outstanding > 0 && (
          <>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={record} onChange={(e) => setRecord(e.target.checked)} />
              <span className="text-sm">
                <span className="font-semibold">Record a settlement repayment of {formatINR(due.outstanding, { paise: true })}</span>
                <span className="block text-slate-500 dark:text-slate-400">Uncheck to close the loan and write off the remaining balance.</span>
              </span>
            </label>
            {record && (
              <Field label="Payment method">
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/** "Send Reminder": prefilled WhatsApp / SMS / call / copy. */
export function ReminderSheet({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const loan = useStore((s) => s.loans.find((l) => l.id === loanId));
  const userName = useStore((s) => s.settings.userName);
  const toast = useUI((s) => s.toast);
  const s = useMemo(() => (loan ? computeLoan(loan) : null), [loan]);
  const [text, setText] = useState(() => {
    if (!loan || !s) return '';
    const due = s.nextDueDate ?? loan.dueDate;
    return [
      `Hi ${loan.borrowerName.split(' ')[0]},`,
      s.status === 'overdue'
        ? `This is a gentle reminder that your loan repayment was due on ${formatDate(due)}.`
        : `This is a friendly reminder that your loan repayment is due on ${formatDate(due)}.`,
      `Outstanding amount: ${formatINR(s.totalOutstanding)} (principal ${formatINR(s.remainingPrincipal)} + interest ${formatINR(s.remainingInterest)}).`,
      'Please let me know when you can pay. Thank you!',
      userName ? `— ${userName}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });
  if (!loan || !s) return null;
  const phone = loan.phone.replace(/[^\d+]/g, '');
  const waPhone = phone.replace(/^\+/, '').length === 10 ? `91${phone}` : phone.replace(/^\+/, '');

  return (
    <Sheet title="Send reminder" subtitle={`${loan.borrowerName}${loan.phone ? ` · ${loan.phone}` : ''}`} onClose={onClose}>
      <div className="space-y-4 pb-2">
        <textarea className="input min-h-[150px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <a className="btn bg-[#25D366] text-white hover:brightness-95" href={`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> WhatsApp
          </a>
          <a className="btn-secondary" href={`sms:${phone}?body=${encodeURIComponent(text)}`}>
            <MessageSquareText size={16} /> SMS
          </a>
          <a className={`btn-secondary ${phone ? '' : 'pointer-events-none opacity-50'}`} href={`tel:${phone}`}>
            <Phone size={16} /> Call
          </a>
          <button
            className="btn-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                toast('Reminder copied');
              } catch {
                toast('Could not copy', { tone: 'danger' });
              }
            }}
          >
            <Copy size={16} /> Copy
          </button>
        </div>
        {!phone && <p className="text-xs text-amber-600">No phone number saved — add one via Edit Loan to use WhatsApp/SMS directly.</p>}
      </div>
    </Sheet>
  );
}
