import clsx from 'clsx';
import { ArrowLeft, Download, Info, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/ui/common';
import { formatDate, formatDateNumeric } from '../lib/dates';
import { downloadCSV } from '../lib/export';
import { round2 } from '../lib/finance';
import { formatINR } from '../lib/format';
import { noteTotals } from '../lib/plans';
import { useSave } from '../lib/useSave';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

export default function NoteDetail() {
  const { id } = useParams();
  const note = useStore((s) => s.notes.find((n) => n.id === id));
  const deleteNote = useStore((s) => s.deleteNote);
  const restoreNote = useStore((s) => s.restoreNote);
  const { open, confirm } = useUI();
  const { run } = useSave();
  const navigate = useNavigate();

  const data = useMemo(() => {
    if (!note) return null;
    const t = noteTotals(note);
    const byDesc = new Map<string, number>();
    for (const e of note.entries.filter((x) => x.type === 'out')) byDesc.set(e.description, (byDesc.get(e.description) ?? 0) + e.amount);
    const breakdown = [...byDesc.entries()].map(([d, a]) => ({ d, a: round2(a) })).sort((a, b) => b.a - a.a);
    const entries = [...note.entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    return { t, breakdown, entries };
  }, [note]);

  if (!note || !data || note.deletedAt) {
    return (
      <div className="card">
        <EmptyState icon={Info} title="Calculation not found" message="It may have been moved to Trash (Settings → Trash)." action={<Link to="/notes" className="btn-primary">All calculations</Link>} />
      </div>
    );
  }
  const { t } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to="/notes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
          <ArrowLeft size={16} /> All calculations
        </Link>
        <button className="btn-primary py-2" onClick={() => open({ kind: 'note' })}>
          <Plus size={16} /> New calculation
        </button>
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{note.name}</h1>
            {note.description && <p className="mt-1 text-sm text-white/85">{note.description}</p>}
          </div>
          <button className="btn bg-white/15 py-2 text-white backdrop-blur hover:bg-white/25" onClick={() => open({ kind: 'note', editId: note.id })}>
            <Pencil size={15} /> Rename
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ['Total spent', t.spent],
            ['Received', t.received],
            [t.net >= 0 ? 'Profit' : 'Net cost', Math.abs(t.net)],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <div className="text-xs text-white/85">{l}</div>
              <div className="num mt-0.5 text-lg font-extrabold sm:text-2xl">{formatINR(v as number)}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
          <button className="btn bg-white text-rose-600 hover:bg-white/90" onClick={() => open({ kind: 'note-entry', noteId: note.id, entryType: 'out' })}>
            <Minus size={16} /> Add expense
          </button>
          <button className="btn bg-white text-emerald-700 hover:bg-white/90" onClick={() => open({ kind: 'note-entry', noteId: note.id, entryType: 'in' })}>
            <Plus size={16} /> Add received
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
            <h2 className="font-bold">Entries ({data.entries.length})</h2>
            <button
              className="btn-ghost py-1.5 text-xs"
              onClick={() =>
                downloadCSV(`${note.name.replace(/[^\w]+/g, '-')}.csv`, [
                  ['Date', 'Type', 'For', 'Amount (INR)', 'Notes'],
                  ...[...note.entries].sort((a, b) => a.date.localeCompare(b.date)).map((e) => [formatDateNumeric(e.date), e.type === 'in' ? 'Received' : 'Spent', e.description, e.amount.toFixed(2), e.notes]),
                  [],
                  ['', '', 'Total spent', t.spent.toFixed(2)],
                  ['', '', 'Total received', t.received.toFixed(2)],
                  ['', '', 'Net', t.net.toFixed(2)],
                ])
              }
            >
              <Download size={14} /> Export
            </button>
          </div>
          {data.entries.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No entries yet. Tap “Add expense” to start.</p>
          ) : (
            <div className="mt-2 divide-y divide-slate-50 dark:divide-white/[0.03]">
              {data.entries.map((e) => (
                <button key={e.id} onClick={() => open({ kind: 'note-entry', noteId: note.id, editId: e.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 sm:px-5">
                  <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', e.type === 'in' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300')}>
                    {e.type === 'in' ? <Plus size={16} /> : <Minus size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{e.description}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(e.date)}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </div>
                  </div>
                  <span className={clsx('num text-sm font-semibold', e.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {e.type === 'in' ? '+' : '−'}
                    {formatINR(e.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="card card-pad lg:col-span-2">
          <h2 className="mb-3 font-bold">Spent on</h2>
          {data.breakdown.length === 0 ? (
            <p className="text-sm text-slate-500">No expenses yet.</p>
          ) : (
            <div className="space-y-3">
              {data.breakdown.slice(0, 12).map(({ d, a }) => (
                <div key={d}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="truncate font-medium">{d}</span>
                    <span className="num font-semibold">{formatINR(a)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${(a / data.breakdown[0].a) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="flex justify-end">
        <button
          className="btn-ghost text-rose-600 dark:text-rose-400"
          onClick={async () => {
            if (await confirm({ title: `Move "${note.name}" to Trash?`, message: 'You can restore it any time from Settings → Trash.', confirmLabel: 'Move to Trash', danger: true }))
              if (await run(() => deleteNote(note.id), 'Moved to Trash', { undo: () => void restoreNote(note.id) })) navigate('/notes');
          }}
        >
          <Trash2 size={16} /> Move to Trash
        </button>
      </div>
    </div>
  );
}
