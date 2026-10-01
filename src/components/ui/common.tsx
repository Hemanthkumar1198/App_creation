import clsx from 'clsx';
import { AlertCircle, CheckCircle2, CircleDot, Clock, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LoanStatus } from '../../types';
import { STATUS_LABEL } from '../../lib/loans';
import { categoryDef } from '../../lib/categories';
import { formatINR } from '../../lib/format';

export type Tone = 'income' | 'expense' | 'loan' | 'brand' | 'neutral' | 'warning' | 'interest';

export const TONE: Record<Tone, { icon: string; text: string }> = {
  income: { icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', text: 'text-emerald-600 dark:text-emerald-400' },
  expense: { icon: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', text: 'text-rose-600 dark:text-rose-400' },
  loan: { icon: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', text: 'text-violet-600 dark:text-violet-300' },
  interest: { icon: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', text: 'text-sky-600 dark:text-sky-300' },
  brand: { icon: 'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300', text: 'text-brand-600 dark:text-brand-300' },
  warning: { icon: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', text: 'text-amber-600 dark:text-amber-300' },
  neutral: { icon: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300', text: 'text-slate-900 dark:text-slate-100' },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
  onClick,
  compact,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  onClick?: () => void;
  compact?: boolean;
}) {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} className={clsx('card card-pad flex flex-col gap-3 text-left', onClick && 'transition hover:-translate-y-0.5 hover:shadow-lg')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-xl', TONE[tone].icon)}>
          <Icon size={16} />
        </span>
      </div>
      <div className={clsx('font-bold tracking-tight', compact ? 'text-lg' : 'text-xl sm:text-2xl', TONE[tone].text)}>{formatINR(value)}</div>
      {hint && <div className="-mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </C>
  );
}

const STATUS_STYLE: Record<LoanStatus, { cls: string; icon: LucideIcon }> = {
  active: { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', icon: CircleDot },
  'partially-paid': { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: Clock },
  'fully-paid': { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: CheckCircle2 },
  overdue: { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', icon: AlertCircle },
};

export function StatusBadge({ status, className }: { status: LoanStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold', s.cls, className)}>
      <s.icon size={12} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CategoryIcon({ category, size = 'md' }: { category: string; size?: 'sm' | 'md' | 'lg' }) {
  const c = categoryDef(category);
  const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  return (
    <span className={clsx('grid shrink-0 place-items-center rounded-xl', dim, c.tone)}>
      <c.icon size={size === 'sm' ? 15 : size === 'lg' ? 22 : 18} />
    </span>
  );
}

export function Amount({ value, type, className }: { value: number; type: 'income' | 'expense' | 'loan'; className?: string }) {
  const sign = type === 'income' ? '+' : type === 'expense' ? '−' : '';
  return <span className={clsx('num font-semibold', TONE[type].text, className)}>{sign}{formatINR(value)}</span>;
}

export function EmptyState({ icon: Icon, title, message, action }: { icon: LucideIcon; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-300">
        <Icon size={26} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={clsx('inline-flex rounded-xl bg-slate-100 p-1 dark:bg-white/5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm',
            value === o.value ? 'bg-white text-slate-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Progress({ value, className, tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'income' }) {
  return (
    <div className={clsx('h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10', className)}>
      <div
        className={clsx('h-full rounded-full', tone === 'income' ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-500 to-blue-500')}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Row({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={clsx('num text-right', strong ? 'font-bold' : 'font-semibold', tone && TONE[tone].text)}>{value}</span>
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
