import clsx from 'clsx';
import {
  Bell,
  CheckCircle2,
  Cloud,
  Database,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileUp,
  HardDrive,
  History,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  RotateCcw,
  Sheet,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ConfirmationResult } from 'firebase/auth';
import { PageHeader, Segmented } from '../components/ui/common';
import { InstallCard } from '../components/InstallCard';
import { formatDate } from '../lib/dates';
import { downloadJSON, exportData, type ExportFormat } from '../lib/export';
import { formatINR } from '../lib/format';
import { toE164 } from '../lib/phone';
import { useSave } from '../lib/useSave';
import { friendlyError, linkGoogle, linkPhone, refreshUser, resetVerifier, signOut, useSession } from '../store/useSession';
import { isBackupFile, makeBackup, readAutoBackup, useStore } from '../store/useStore';
import { useTheme } from '../store/useTheme';
import { useUI } from '../store/useUI';
import type { ThemeMode } from '../types';

function Section({ icon: Icon, title, desc, children, id }: { icon: typeof User; title: string; desc?: string; children: ReactNode; id?: string }) {
  return (
    <section className="card card-pad" id={id}>
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

function AccountSection() {
  const user = useSession((s) => s.user);
  const mode = useStore((s) => s.mode);
  const { confirm, toast } = useUI();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'' | 'phone' | 'otp'>('');
  const [busy, setBusy] = useState(false);
  const conf = useRef<ConfirmationResult | null>(null);

  if (mode === 'local' || !user) {
    return (
      <Section icon={HardDrive} title="Device-only mode" desc="Cloud sync is not configured for this website yet.">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your data is stored in this browser only. To enable secure sign-in (Google / mobile OTP) and cloud backup across devices, the site owner needs to add a Firebase project — see the README “Enable sign-in & cloud backup”.
          Until then, download a backup regularly.
        </p>
      </Section>
    );
  }

  const hasGoogle = user.providers.includes('google.com');
  const hasPhone = user.providers.includes('phone');
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      return true;
    } catch (e) {
      toast(friendlyError(e), { tone: 'danger' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section icon={ShieldCheck} title="Account & security" desc="Your data is stored securely in your account and syncs across devices.">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="h-11 w-11 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-blue-500 font-bold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{user.name}</div>
          <div className="truncate text-xs text-slate-500">{[user.email, user.phone].filter(Boolean).join(' · ')}</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Cloud size={12} /> Synced
        </span>
      </div>

      <div className="mt-4">
        <span className="label">Sign-in methods</span>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Link both so you can always get back into the same account (and the same data).</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <span className="text-sm font-medium">Google {user.email && hasGoogle ? `· ${user.email}` : ''}</span>
            {hasGoogle ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <button className="btn-secondary py-1.5 text-xs" disabled={busy} onClick={() => act(linkGoogle, 'Google account linked')}>
                Link Google
              </button>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Mobile number {hasPhone && user.phone ? `· ${user.phone}` : ''}</span>
              {hasPhone ? (
                <CheckCircle2 size={18} className="text-emerald-600" />
              ) : (
                !step && (
                  <button className="btn-secondary py-1.5 text-xs" onClick={() => setStep('phone')}>
                    <Smartphone size={14} /> Link number
                  </button>
                )
              )}
            </div>
            {step === 'phone' && (
              <div className="mt-3 flex gap-2">
                <input className="input" type="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
                <button
                  className="btn-primary shrink-0"
                  disabled={busy}
                  onClick={async () => {
                    const e164 = toE164(phone);
                    if (!e164) return toast('Enter a valid mobile number', { tone: 'danger' });
                    if (await act(async () => (conf.current = await linkPhone(e164, 'link-recaptcha')), 'OTP sent')) setStep('otp');
                  }}
                >
                  {busy && <Loader2 size={14} className="animate-spin" />} Send OTP
                </button>
              </div>
            )}
            {step === 'otp' && (
              <div className="mt-3 flex gap-2">
                <input className="input num tracking-widest" inputMode="numeric" maxLength={6} placeholder="6-digit OTP" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
                <button
                  className="btn-primary shrink-0"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await act(async () => {
                        await conf.current?.confirm(code);
                        await refreshUser();
                      }, 'Mobile number linked')
                    ) {
                      setStep('');
                      resetVerifier();
                    }
                  }}
                >
                  Verify
                </button>
              </div>
            )}
            <div id="link-recaptcha" />
          </div>
        </div>
      </div>

      <button
        className="btn-secondary mt-4 w-full text-rose-600 dark:text-rose-400"
        onClick={async () => {
          if (await confirm({ title: 'Sign out?', message: 'Your data stays safe in your account. The offline copy on this device will be removed.', confirmLabel: 'Sign out' })) {
            try {
              await signOut();
            } catch (e) {
              toast(friendlyError(e), { tone: 'danger' });
            }
          }
        }}
      >
        <LogOut size={16} /> Sign out
      </button>
    </Section>
  );
}

export default function Settings() {
  const st = useStore();
  const { settings, transactions, loans, activity, mode } = st;
  const { confirm, toast } = useUI();
  const { saving, run } = useSave();
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [exporting, setExporting] = useState<'' | ExportFormat>('');
  const [name, setName] = useState(settings.userName);

  const { notes, plans } = st;
  // Imports save all their rows with the same creation time, so they can be found and undone as a group.
  const imports = useMemo(() => {
    const groups = new Map<string, { key: string; kind: 'tx' | 'loan'; at: string; ids: string[]; total: number; sample: string }>();
    for (const t of transactions) {
      if (t.deletedAt) continue;
      const k = `tx|${t.createdAt}`;
      const g = groups.get(k) ?? { key: k, kind: 'tx' as const, at: t.createdAt, ids: [], total: 0, sample: t.description || t.category };
      g.ids.push(t.id);
      g.total += t.amount;
      groups.set(k, g);
    }
    for (const l of loans) {
      if (l.deletedAt) continue;
      const k = `loan|${l.createdAt}`;
      const g = groups.get(k) ?? { key: k, kind: 'loan' as const, at: l.createdAt, ids: [], total: 0, sample: l.borrowerName };
      g.ids.push(l.id);
      g.total += l.principal;
      groups.set(k, g);
    }
    return [...groups.values()]
      .filter((g) => g.ids.length >= 2)
      .map((g) => ({ ...g, count: g.ids.length }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [transactions, loans]);
  const trash = useMemo(
    () =>
      [
        ...transactions.filter((t) => t.deletedAt).map((t) => ({ id: t.id, kind: 'transaction' as const, label: `${t.description || t.category} · ${formatINR(t.amount)}`, at: t.deletedAt! })),
        ...loans.filter((l) => l.deletedAt).map((l) => ({ id: l.id, kind: 'loan' as const, label: `Interest record: ${l.borrowerName} · ${formatINR(l.principal)}`, at: l.deletedAt! })),
        ...notes.filter((n) => n.deletedAt).map((n) => ({ id: n.id, kind: 'note' as const, label: `Calculation: ${n.name}`, at: n.deletedAt! })),
        ...plans.filter((p) => p.deletedAt).map((p) => ({ id: p.id, kind: 'plan' as const, label: `${p.kind}: ${p.name}`, at: p.deletedAt! })),
      ].sort((a, b) => b.at.localeCompare(a.at)),
    [transactions, loans, notes, plans],
  );


  const backup = () => {
    downloadJSON(`paisa-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`, makeBackup());
    toast('Backup downloaded');
  };

  const exportAll = async (format: ExportFormat) => {
    setExporting(format);
    try {
      await exportData(format, transactions, loans, { label: `Full export ${formatDate(new Date().toISOString().slice(0, 10))}` }, { notes, plans });
      toast('Export downloaded');
    } catch (e) {
      console.error(e);
      toast('Export failed — please try again', { tone: 'danger' });
    } finally {
      setExporting('');
    }
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
      run(() => st.replaceAll(data, `Restored backup from ${data.exportedAt.slice(0, 10)}`), 'Backup restored');
    } catch {
      toast('That file is not a valid Paisa Ledger backup (.json). To bring in Excel/CSV/PDF files, use Import data.', { tone: 'danger' });
    }
  };

  const auto = mode === 'local' ? readAutoBackup() : null;

  const enableNotifications = async (on: boolean) => {
    if (on) {
      if (!('Notification' in window)) return toast('This browser does not support notifications', { tone: 'danger' });
      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return toast('Notifications were blocked by the browser', { tone: 'danger' });
      } catch {
        return toast('Could not enable notifications', { tone: 'danger' });
      }
    }
    run(() => st.updateSettings({ browserNotifications: on }), on ? 'Browser reminders enabled' : 'Browser reminders disabled');
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Account, backups and data safety" />
      <div className="grid gap-4 lg:grid-cols-2">
        <AccountSection />

        <Section icon={ShieldCheck} title="Your data is protected" desc="How Paisa Ledger keeps your entries safe for the long term.">
          <ul className="space-y-2.5 text-sm">
            {[
              mode === 'cloud'
                ? ['Saved to your account', 'Every entry is stored in your own Firebase (Google Cloud) database, which keeps multiple copies. Clearing the browser, a new phone or a new laptop never loses it.']
                : ['Stored on this device', 'Sign-in is not configured here, so data lives in this browser. Download backups regularly.'],
              ['Never permanently deleted', 'Delete moves an item to Trash, where it is kept forever and can be restored. The server blocks every permanent delete.'],
              ['Every change is versioned', 'Before any edit, the previous version is saved to a history that can never be changed or removed.'],
              ['Private to you', 'Only your login can read or change your records; others are blocked by the database rules.'],
              ['Works offline', 'Entries made without internet are stored on the device and sync automatically later.'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2.5">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  <b>{t}.</b> <span className="text-slate-600 dark:text-slate-300">{d}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Extra copy any time: Export & backup → Full backup (.json) or Excel.</p>
        </Section>

        <Section icon={Smartphone} title="Install app & offline" desc="Use Paisa Ledger like a normal app on your phone or computer.">
          <InstallCard />
        </Section>

        <Section icon={User} title="Profile & appearance">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Your name</label>
              <div className="flex gap-2">
                <input id="name" className="input" placeholder="Used in greetings and reminder messages" value={name} onChange={(e) => setName(e.target.value)} />
                {name !== settings.userName && (
                  <button className="btn-primary shrink-0" disabled={saving} onClick={() => run(() => st.updateSettings({ userName: name.trim().slice(0, 60) }), 'Name saved')}>
                    Save
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className="label">Theme (this device)</span>
              <Segmented<ThemeMode>
                value={theme}
                onChange={setTheme}
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

        <Section icon={FileSpreadsheet} title="Export & backup" desc="Everything is exported in separate sections: Daily Expenses, Income, Investments, Loans, Loan Repayments and Outstanding Loans.">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['xlsx', 'Excel', FileSpreadsheet],
                ['csv', 'CSV', Sheet],
                ['pdf', 'PDF', FileText],
              ] as const
            ).map(([f, label, Icon]) => (
              <button key={f} className="btn-secondary" disabled={!!exporting} onClick={() => exportAll(f)}>
                {exporting === f ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />} {label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button className="btn-primary" onClick={backup}>
              <FileJson size={16} /> Full backup (.json)
            </button>
            <button className="btn-secondary" disabled={saving} onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Restore backup
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
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {mode === 'cloud' ? 'Your data is already saved in your account. A .json backup is an extra copy you control.' : 'Data is stored only in this browser — download a backup regularly.'}
          </p>
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
                  if (await confirm({ title: 'Restore daily snapshot?', message: 'Your current data will be replaced with the snapshot taken when you first opened the app today.', confirmLabel: 'Restore', danger: true }))
                    run(() => st.replaceAll(auto, 'Restored daily snapshot'), 'Snapshot restored');
                }}
              >
                <RotateCcw size={15} /> Restore
              </button>
            </div>
          )}
          <Link to="/import" className="btn-ghost mt-2 w-full">
            <FileUp size={16} /> Import from Excel, CSV or PDF
          </Link>
        </Section>

        <Section icon={Bell} title="Reminders" desc="Due dates, overdue loans, pending repayments and a monthly expense summary appear under the bell icon.">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="days">Remind me about loans due within</label>
              <select id="days" className="input" value={settings.reminderDays} onChange={(e) => run(() => st.updateSettings({ reminderDays: Number(e.target.value) }), 'Reminder window saved')}>
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

        <Section icon={FileUp} title="Recent imports" desc="Imported the wrong file, or into the wrong section? Move that whole import to Trash in one tap (restorable).">
          {imports.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-white/5">No imports yet.</p>
          ) : (
            <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
              {imports.map((b) => (
                <div key={b.key} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {b.count} {b.kind === 'tx' ? (b.count === 1 ? 'transaction' : 'transactions') : b.count === 1 ? 'interest record' : 'interest records'} · {formatINR(b.total)}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {formatDate(b.at.slice(0, 10))} {new Date(b.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {b.sample}
                    </div>
                  </div>
                  <button
                    className="btn-ghost px-2.5 py-1.5 text-xs text-rose-600"
                    disabled={saving}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: 'Undo this import?',
                          message: `${b.count} ${b.kind === 'tx' ? 'transactions' : 'interest records'} (${formatINR(b.total)}) will be moved to Trash. You can restore them any time.`,
                          confirmLabel: 'Move to Trash',
                          danger: true,
                        })
                      )
                        run(() => st.trashMany(b.kind === 'tx' ? b.ids : [], b.kind === 'loan' ? b.ids : [], `Undid import of ${b.count} records`), 'Import moved to Trash');
                    }}
                  >
                    <RotateCcw size={14} /> Undo import
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon={Trash2} title={`Trash (${trash.length})`} desc="Deleted transactions and loans are kept here forever and can be restored at any time.">
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
                    <button className="btn-ghost px-2.5 py-1.5 text-xs" disabled={saving} onClick={() => run(() => (t.kind === 'loan' ? st.restoreLoan(t.id) : t.kind === 'note' ? st.restoreNote(t.id) : t.kind === 'plan' ? st.restorePlan(t.id) : st.restoreTransaction(t.id)), 'Restored')}>
                      <RotateCcw size={14} /> Restore
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Items in Trash are kept forever and can always be restored.</p>
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

        <Section icon={Database} title="Data" desc={`${transactions.filter((t) => !t.deletedAt).length} transactions · ${loans.filter((l) => !l.deletedAt).length} loans · ${mode === 'cloud' ? 'saved to your account' : 'stored in this browser'}`}>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className="btn-secondary"
              disabled={saving}
              onClick={async () => {
                if (await confirm({ title: 'Load demo data?', message: 'Your current transactions and loans will be moved to Trash (restorable) and replaced with demo data.', confirmLabel: 'Replace with demo data', danger: true, typeToConfirm: transactions.length || loans.length ? 'DEMO' : undefined }))
                  run(st.loadSampleData, 'Demo data loaded');
              }}
            >
              <Sparkles size={16} /> Load demo data
            </button>
            <button
              className="btn-secondary text-rose-600 dark:text-rose-400"
              disabled={saving}
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Move everything to Trash?',
                    message: 'All transactions and loans will be hidden and moved to Trash. Nothing is erased: you can restore any item from Trash at any time.',
                    confirmLabel: 'Move to Trash',
                    danger: true,
                    typeToConfirm: 'TRASH',
                  })
                )
                  run(st.moveAllToTrash, 'Everything moved to Trash (restorable)');
              }}
            >
              <Trash2 size={16} /> Clear (move all to Trash)
            </button>
          </div>
        </Section>
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">Paisa Ledger v2.0 · {mode === 'cloud' ? 'Cloud sync on · works offline' : 'Device-only mode'}</p>
    </div>
  );
}
