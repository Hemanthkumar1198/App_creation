import { ChevronRight, NotebookPen, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, PageHeader } from '../components/ui/common';
import { formatDate } from '../lib/dates';
import { formatINR } from '../lib/format';
import { noteTotals } from '../lib/plans';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

/** Separate calculation books (e.g. "Paddy harvest 2026"), kept apart from daily expenses. */
export default function Notes() {
  const notes = useStore((s) => s.notes);
  const open = useUI((s) => s.open);
  const list = useMemo(
    () =>
      notes
        .filter((n) => !n.deletedAt)
        .map((n) => ({ n, t: noteTotals(n) }))
        .sort((a, b) => (b.t.lastDate ?? b.n.createdAt).localeCompare(a.t.lastDate ?? a.n.createdAt)),
    [notes],
  );

  return (
    <div>
      <PageHeader
        title="Calculation Notes"
        subtitle="Separate calculations for one purpose, like paddy harvest or house construction. Not mixed with daily expenses."
        actions={
          <button className="btn-primary" onClick={() => open({ kind: 'note' })}>
            <Plus size={16} /> New calculation
          </button>
        }
      />
      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={NotebookPen}
            title="No calculations yet"
            message='Create one, e.g. "Paddy harvest 2026", then add every expense (labour, seeds, fertiliser, tractor…) and what you received.'
            action={
              <button className="btn-primary" onClick={() => open({ kind: 'note' })}>
                <Plus size={16} /> New calculation
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(({ n, t }) => (
            <Link key={n.id} to={`/notes/${n.id}`} className="card card-pad group block transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <NotebookPen size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{n.name}</div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">{n.description || `${t.count} entries`}</div>
                </div>
                <ChevronRight size={18} className="text-slate-400 transition group-hover:translate-x-0.5" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Spent</div>
                  <div className="num mt-0.5 text-sm font-bold text-rose-600 dark:text-rose-400">{formatINR(t.spent)}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Received</div>
                  <div className="num mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(t.received)}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 dark:text-slate-400">{t.net >= 0 ? 'Profit' : 'Net cost'}</div>
                  <div className={`num mt-0.5 text-sm font-bold ${t.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{formatINR(Math.abs(t.net))}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {t.count} entries{t.lastDate ? ` · last ${formatDate(t.lastDate)}` : ''}
              </div>
            </Link>
          ))}
          <button
            onClick={() => open({ kind: 'note' })}
            className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-white/15 dark:text-brand-300 dark:hover:bg-white/5"
          >
            <Plus size={22} /> Create another calculation
            <span className="text-xs font-normal text-slate-500">Any name: farming, construction, wedding, trip…</span>
          </button>
        </div>
      )}
    </div>
  );
}
