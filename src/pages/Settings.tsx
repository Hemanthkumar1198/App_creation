import clsx from 'clsx';
import {
  Bell,
  Database,
  Download,
  FileJson,
  History,
  Monitor,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PageHeader, Segmented } from '../components/ui/common';
import { formatDate } from '../lib/dates';
import { downloadCSV, downloadJSON, loansRows, repaymentsRows, transactionsRows } from '../lib/export';
import { formatINR } from '../lib/format';
import { isBackupFile, makeBackup, readAutoBackup, useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import type { ThemeMode } from '../types';

function Section({ icon: Icon, title, desc, children }: { icon: typeof User; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="card card-pad">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="font-bold">{title}</h2>
          {desc && <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Settings() {
  const st = useStore();
  const { settings, updateSettings, transactions, loans, activity } = st;
  const { confirm, toast } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const trash = useMemo(
    () => [
      ...transactions.filter((t) => t.deletedAt).map((t) => ({ id: t.id, kind: 'transaction' as const, label: `${t.description || t.category} · ${formatINR(t.amount)}`, at: t.deletedAt! })),
      ...loans.filter((l) => l.deletedAt).map((l) => ({ id: l.id, kind: 'loan' as const, label: `Loan to ${l.borrowerName} · ${formatINR(l.principal)}`, at: l.deletedAt! })),
    ].sort((a, b) => b.at.localeCompare(a.at)),
    [transactions, loans],
  );

  const backup = () => {
    downloadJSON(`paisa-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`, makeBackup());
    toast('Backup downloaded');
  };

  const restoreFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!isBackupFile(data)) throw new Error('bad');
      const ok = await confirm({
        title: 'Restore this backup?',
        message: `This replaces your current data with ${data.transactions.length} transactions and ${data.loans.length} loans from ${formatDate(data.exportedAt.slice(0, 10))}. Download a backup of your current data first if unsure.`,
        confirmLabel: 'Restore',
        danger: true,
      });
      if (!ok) return;
      st.importBackup(data);
      toast('Backup restored');
    } catch {
      toast('That file is not a valid Paisa Ledger backup', { tone: 'danger' });
    }
  };

  const auto = readAutoBackup();
  const storageKB = useMemo(() => {
    try {
      return Math.round(((localStorage.getItem('paisa-ledger:v1') ?? '').length * 2) / 1024);
    } catch {
      return 0;
    }
  }, [transactions, loans]);

  const enableNotifications = async (on: boolean) => {
    if (on && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast('Notifications were blocked by the browser', { tone: 'danger' });
        return;
      }
    }
    updateSettings({ browserNotifications: on });
    toast(on ? 'Browser reminders enabled' : 'Browser reminders disabled', { tone: 'info' });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Preferences, backups and data safety" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={User} title="Profile & appearance">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Your name</label>
              <input id="name" className="input" placeholder="Used in greetings and reminder messages" value={settings.userName} onChange={(e) => updateSettings({ userName: e.target.value })} />
            </div>
            <div>
              <span className="label">Theme</span>
              <Segmented<ThemeMode>
                value={settings.theme}
                onChange={(theme) => updateSettings({ theme })}
                options={[
                  { value: 'light', label: <span className="flex items-center justify-center gap-1.5"><Sun size={14} /> Light</span> },
                  { value: 'dark', label: <span className="flex items-center justify-center gap-1.5"><Moon size={14} /> Dark</span> },
                  { value: 'system', label: <span className="flex items-center justify-center gap-1.5"><Monitor size={14} /> System</span> },
                ]}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Currency: Indian Rupee (₹ INR) · Amounts rounded to 2 decimals</p>
          </div>
        </Section>

        <Section icon={Bell} title="Reminders" desc="Due dates, overdue loans, pending repayments and a monthly expense summary appear under the bell icon.">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="days">Remind me about loans due within</label>
              <select id="days" className="input" value={settings.reminderDays} onChange={(e) => updateSettings({ reminderDays: Number(e.target.value) })}>
                {[3, 5, 7, 10, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3.5 dark:border-white/10">
              <span className="text-sm">
                <span className="block font-semibold">Browser notifications</span>
                <span className="text-slate-500 dark:text-slate-400">Show a system notification for overdue and due-soon loans when you open the app.</span>
              </span>
              <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={settings.browserNotifications} onChange={(e) => enableNotifications(e.target.checked)} />
            </label>
          </div>
        </Section>

        <Section icon={ShieldCheck} title="Backup & restore" desc="Your data is stored on this device. Download a backup regularly and keep it somewhere safe.">
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn-primary" onClick={backup}>
              <FileJson size={16} /> Download backup
            </button>
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Restore from file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) restoreFile(f);
                e.target.value = '';
              }}
            />
          </div>
          {auto && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5">
              <span>
                <span className="block font-semibold">Automatic daily snapshot</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatDate(auto.exportedAt.slice(0, 10))} · {auto.transactions.length} transactions, {auto.loans.length} loans
                </span>
              </span>
              <button
                className="btn-secondary shrink-0 py-2"
                onClick={async () => {
                  if (await confirm({ title: 'Restore daily snapshot?', message: 'Your current data will be replaced with the snapshot taken when you first opened the app today.', confirmLabel: 'Restore', danger: true })) {
                    st.importBackup(auto);
                    toast('Snapshot restored');
                  }
                }}
              >
                <RotateCcw size={15} /> Restore
              </button>
            </div>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button className="btn-secondary" onClick={() => downloadCSV('transactions.csv', transactionsRows(transactions))}>
              <Download size={15} /> Transactions
            </button>
            <button className="btn-secondary" onClick={() => downloadCSV('loans.csv', loansRows(loans))}>
              <Download size={15} /> Loans
            </button>
            <button className="btn-secondary" onClick={() => downloadCSV('repayments.csv', repaymentsRows(loans))}>
              <Download size={15} /> Repayments
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">CSV files open directly in Excel or Google Sheets.</p>
        </Section>

        <Section icon={Trash2} title={`Trash (${trash.length})`} desc="Deleted transactions and loans are kept here until you remove them permanently.">
          {trash.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-white/5">Trash is empty.</p>
          ) : (
            <>
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
                {trash.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.label}</div>
                      <div className="text-xs text-slate-500">Deleted {formatDate(t.at.slice(0, 10))}</div>
                    </div>
                    <button
                      className="btn-ghost px-2.5 py-1.5 text-xs"
                      onClick={() => {
                        t.kind === 'loan' ? st.restoreLoan(t.id) : st.restoreTransaction(t.id);
                        toast('Restored');
                      }}
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                    <button
                      className="btn-ghost px-2.5 py-1.5 text-xs text-rose-600"
                      aria-label="Delete permanently"
                      onClick={async () => {
                        if (await confirm({ title: 'Delete permanently?', message: `${t.label} will be erased forever. This cannot be undone.`, confirmLabel: 'Delete forever', danger: true })) {
                          t.kind === 'loan' ? st.purgeLoan(t.id) : st.purgeTransaction(t.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="btn-ghost mt-2 text-rose-600"
                onClick={async () => {
                  if (await confirm({ title: 'Empty trash?', message: `${trash.length} item(s) will be erased forever.`, confirmLabel: 'Empty trash', danger: true })) st.emptyTrash();
                }}
              >
                Empty trash
              </button>
            </>
          )}
        </Section>

        <Section icon={History} title="Activity history" desc="A log of every change, so you always know what happened.">
          {activity.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-white/5">No activity yet.</p>
          ) : (
            <>
              <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-4 dark:border-white/10">
                {(showAllActivity ? activity : activity.slice(0, 8)).map((a) => (
                  <li key={a.id} className="relative">
                    <span
                      className={clsx(
                        'absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-ink-850',
                        a.action === 'deleted' || a.action === 'purged' ? 'bg-rose-500' : a.action === 'created' || a.action === 'repayment' ? 'bg-emerald-500' : 'bg-brand-500',
                      )}
                    />
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-xs text-slate-500">
                      {formatDate(a.at.slice(0, 10))} · {new Date(a.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </li>
                ))}
              </ol>
              {activity.length > 8 && (
                <button className="btn-ghost mt-2 text-xs" onClick={() => setShowAllActivity((s) => !s)}>
                  {showAllActivity ? 'Show less' : `Show all ${activity.length}`}
                </button>
              )}
            </>
          )}
        </Section>

        <Section icon={Database} title="Data" desc={`${transactions.filter((t) => !t.deletedAt).length} transactions · ${loans.filter((l) => !l.deletedAt).length} loans · ~${storageKB} KB on this device`}>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className="btn-secondary"
              onClick={async () => {
                if (await confirm({ title: 'Load sample data?', message: 'This replaces your current transactions and loans with demo data. Download a backup first if you want to keep your data.', confirmLabel: 'Load sample data', danger: true })) {
                  st.loadSampleData();
                  toast('Sample data loaded');
                }
              }}
            >
              <Sparkles size={16} /> Load sample data
            </button>
            <button
              className="btn-secondary text-rose-600 dark:text-rose-400"
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Erase all data?',
                    message: 'Every transaction, loan and repayment on this device will be erased. This cannot be undone.',
                    confirmLabel: 'Erase everything',
                    danger: true,
                    typeToConfirm: 'DELETE',
                  })
                ) {
                  st.clearAllData();
                  toast('All data erased', { tone: 'danger' });
                }
              }}
            >
              <Trash2 size={16} /> Erase all data
            </button>
          </div>
        </Section>
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">Paisa Ledger v1.0 · Works offline · Data never leaves your device</p>
    </div>
  );
}
