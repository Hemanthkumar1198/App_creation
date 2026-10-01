import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { categoryDef } from '../../lib/categories';
import { formatINR, formatINRCompact } from '../../lib/format';
import { useIsDark } from '../Layout';

export const SERIES = {
  income: { light: '#059669', dark: '#34d399' },
  expense: { light: '#e11d48', dark: '#fb7185' },
  loan: { light: '#7c3aed', dark: '#a78bfa' },
  interest: { light: '#0284c7', dark: '#38bdf8' },
};
export type SeriesKey = keyof typeof SERIES;

function useColors() {
  const dark = useIsDark();
  const pick = (k: SeriesKey) => (dark ? SERIES[k].dark : SERIES[k].light);
  return { dark, pick, axis: dark ? '#7c7c92' : '#94a3b8' };
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-ink-800/95">
      <div className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey as string} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: (p.payload?.fill as string) || p.color }} />
            {p.name}
          </span>
          <span className="num font-semibold text-slate-900 dark:text-white">{formatINR(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

const axisProps = (color: string) => ({
  tickLine: false,
  axisLine: false,
  tick: { fill: color, fontSize: 11 },
});

function LegendText(value: string) {
  return <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{value}</span>;
}

export function IncomeExpenseChart({ data, height = 260 }: { data: { label: string; income: number; expense: number }[]; height?: number }) {
  const { pick, axis } = useColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey="label" {...axisProps(axis)} />
        <YAxis {...axisProps(axis)} tickFormatter={formatINRCompact} width={56} />
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" iconSize={8} formatter={LegendText} wrapperStyle={{ paddingTop: 8 }} />
        <Bar dataKey="income" name="Income" fill={pick('income')} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expense" name="Expenses" fill={pick('expense')} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SingleSeriesBar({ data, series, name, height = 220 }: { data: { label: string; value: number }[]; series: SeriesKey; name: string; height?: number }) {
  const { pick, axis } = useColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...axisProps(axis)} />
        <YAxis {...axisProps(axis)} tickFormatter={formatINRCompact} width={56} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="value" name={name} fill={pick(series)} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendArea({ data, series, name, height = 220 }: { data: { label: string; value: number }[]; series: SeriesKey; name: string; height?: number }) {
  const { pick, axis } = useColors();
  const c = pick(series);
  const id = `grad-${series}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={0.3} />
            <stop offset="100%" stopColor={c} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...axisProps(axis)} />
        <YAxis {...axisProps(axis)} tickFormatter={formatINRCompact} width={56} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="value" name={name} stroke={c} strokeWidth={2} fill={`url(#${id})`} activeDot={{ r: 5, strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Net cash flow: bars above zero in income green, below in expense red. */
export function CashFlowChart({ data, height = 240, name = "Net savings" }: { data: { label: string; value: number }[]; height?: number; name?: string }) {
  const { pick, axis } = useColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...axisProps(axis)} />
        <YAxis {...axisProps(axis)} tickFormatter={formatINRCompact} width={56} />
        <ReferenceLine y={0} stroke={axis} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="value" name={name} radius={[4, 4, 4, 4]} maxBarSize={28}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? pick('income') : pick('expense')} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranked horizontal bars with direct labels — easier to read than a pie on phones. */
export function CategoryBars({ data, max = 6 }: { data: { category: string; amount: number; share: number }[]; max?: number }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-slate-500">No expenses in this period.</p>;
  const top = data.slice(0, max);
  const rest = data.slice(max);
  const rows = rest.length
    ? [...top, { category: `Other (${rest.length})`, amount: rest.reduce((a, b) => a + b.amount, 0), share: rest.reduce((a, b) => a + b.share, 0) }]
    : top;
  const peak = Math.max(...rows.map((r) => r.amount));
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const def = categoryDef(r.category.startsWith('Other (') ? 'Other' : r.category);
        return (
          <div key={r.category} className="flex items-center gap-3">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${def.tone}`}>
              <def.icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{r.category}</span>
                <span className="num shrink-0 font-semibold">
                  {formatINR(r.amount)} <span className="text-xs font-normal text-slate-500">{r.share.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                <div className="h-full rounded-full bg-rose-500 dark:bg-rose-400" style={{ width: `${(r.amount / peak) * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
