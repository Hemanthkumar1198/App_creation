import clsx from 'clsx';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BarChart3,
  HandCoins,
  LayoutDashboard,
  Moon,
  Plus,
  ReceiptText,
  Search,
  Settings as SettingsIcon,
  Sun,
  X,
  AlertCircle,
  Clock,
  CalendarClock,
  PieChart,
  Cloud,
  CloudOff,
  RefreshCw,
  HardDrive,
  FileUp,
  ShieldCheck,
  NotebookPen,
  TrendingUp,
  Menu,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useTheme } from '../store/useTheme';
import { useSession } from '../store/useSession';
import { useUI } from '../store/useUI';
import { buildReminders, type Reminder } from '../lib/reminders';
import { todayISO } from '../lib/dates';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/loans', label: 'Interest Calculation', short: 'Interest', icon: HandCoins },
  { to: '/notes', label: 'Calculation Notes', short: 'Notes', icon: NotebookPen },
  { to: '/investments', label: 'Investments & Insurance', short: 'Invest', icon: TrendingUp },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

/** Phone bottom bar: the four most-used sections + "More". */
const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Cashbook', icon: ReceiptText },
  { to: '/loans', label: 'Interest', icon: HandCoins },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
  { to: '/more', label: 'More', icon: Menu },
];

export function useIsDark() {
  const theme = useTheme((s) => s.theme);
  const [sys, setSys] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSys(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return theme === 'dark' || (theme === 'system' && sys);
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="./icon.svg" alt="" className="h-9 w-9 rounded-xl shadow-glow" />
      <div className="leading-tight">
        <div className="whitespace-nowrap text-[15px] font-extrabold tracking-tight">Paisa Ledger</div>
        <div className="hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">Money & loans</div>
      </div>
    </div>
  );
}

function SearchBox({ className, autoFocus, onDone }: { className?: string; autoFocus?: boolean; onDone?: () => void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const loc = useLocation();
  const [q, setQ] = useState(loc.pathname === '/search' ? params.get('q') ?? '' : '');
  return (
    <form
      className={clsx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/search?q=${encodeURIComponent(q.trim())}`);
        onDone?.();
      }}
    >
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search transactions, people, amounts, dates…"
        className="input rounded-full border-transparent bg-slate-100 pl-10 dark:bg-white/5"
        aria-label="Global search"
      />
    </form>
  );
}

const REMINDER_ICON: Record<Reminder['kind'], { icon: typeof Bell; cls: string }> = {
  overdue: { icon: AlertCircle, cls: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' },
  pending: { icon: Clock, cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
  'due-soon': { icon: CalendarClock, cls: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300' },
  summary: { icon: PieChart, cls: 'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' },
};

export function useReminders() {
  const loans = useStore((s) => s.loans);
  const txs = useStore((s) => s.transactions);
  const plans = useStore((s) => s.plans);
  const days = useStore((s) => s.settings.reminderDays);
  return useMemo(() => buildReminders(loans, txs, days, todayISO(), plans), [loans, txs, days, plans]);
}

function Notifications() {
  const reminders = useReminders();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const urgent = reminders.filter((r) => r.kind !== 'summary').length;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button className="relative rounded-full p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell size={20} />
        {urgent > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{urgent}</span>}
      </button>
      {open && (
        <div className="animate-fade-in absolute right-0 top-12 z-40 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-ink-850">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
            <span className="font-bold">Reminders</span>
            <span className="text-xs text-slate-500">{reminders.length} items</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {reminders.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up 🎉</p>}
            {reminders.map((r) => {
              const I = REMINDER_ICON[r.kind];
              return (
                <button
                  key={r.id}
                  className="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                  onClick={() => {
                    setOpen(false);
                    navigate(r.loanId ? `/loans/${r.loanId}` : r.planId ? `/investments/${r.planId}` : '/reports');
                  }}
                >
                  <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', I.cls)}>
                    <I.icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{r.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{r.message}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const dark = useIsDark();
  const setTheme = useTheme((s) => s.setTheme);
  return (
    <button
      className="rounded-full p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

/** Shows whether everything is saved to the cloud, still syncing, or offline. */
function SyncStatus() {
  const mode = useStore((s) => s.mode);
  const pending = useStore((s) => s.pendingSync);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (mode === 'local')
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 sm:inline-flex" title="Data is stored only in this browser">
        <HardDrive size={12} /> This device only
      </span>
    );
  const [Icon, label, cls] = !online
    ? [CloudOff, pending ? 'Offline · will sync' : 'Offline', 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300']
    : pending
      ? [RefreshCw, 'Saving…', 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300']
      : [Cloud, 'Saved', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', cls)} title={online ? 'All changes are saved to your account' : 'Changes are kept on this device and sync automatically'}>
      <Icon size={12} className={pending && online ? 'animate-spin' : ''} /> <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function AccountButton() {
  const user = useSession((s) => s.user);
  if (!user) return null;
  const initials = user.name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '₹';
  return (
    <NavLink to="/settings" className="ml-1 grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-blue-500 text-xs font-bold text-white" title={user.name} aria-label="Account">
      {user.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials}
    </NavLink>
  );
}

function SyncErrorBanner() {
  const err = useStore((s) => s.syncError);
  if (!err) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
      <span>{err}</span>
      <button className="btn-secondary py-1.5" onClick={() => window.location.reload()}>
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );
}

function Fab() {
  const [open, setOpen] = useState(false);
  const openSheet = useUI((s) => s.open);
  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  return (
    <div className="fixed bottom-[84px] right-4 z-30 flex flex-col items-end gap-2 lg:hidden">
      {open && (
        <>
          <div className="fixed inset-0 -z-10 bg-slate-950/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          {[
            { label: 'Cash In', icon: ArrowDownLeft, cls: 'bg-emerald-600', run: () => openSheet({ kind: 'tx', txType: 'income' }) },
            { label: 'Cash Out', icon: ArrowUpRight, cls: 'bg-rose-600', run: () => openSheet({ kind: 'tx', txType: 'expense' }) },
            { label: 'Interest record', icon: HandCoins, cls: 'bg-violet-600', run: () => openSheet({ kind: 'loan' }) },
            { label: 'Calculation note', icon: NotebookPen, cls: 'bg-orange-500', run: () => (window.location.hash = '#/notes') },
          ].map((a) => (
            <button key={a.label} onClick={() => go(a.run)} className="animate-slide-up flex items-center gap-2 rounded-full bg-white py-1.5 pl-4 pr-1.5 text-sm font-semibold shadow-lg dark:bg-ink-800">
              {a.label}
              <span className={clsx('grid h-9 w-9 place-items-center rounded-full text-white', a.cls)}>
                <a.icon size={18} />
              </span>
            </button>
          ))}
        </>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-blue-600 text-white shadow-glow transition active:scale-95"
        aria-label="Quick add"
      >
        <Plus size={26} className={clsx('transition', open && 'rotate-45')} />
      </button>
    </div>
  );
}

function SidebarCard() {
  const mode = useStore((s) => s.mode);
  return (
    <div className="mt-auto rounded-2xl bg-gradient-to-br from-brand-600 to-blue-600 p-4 text-white">
      <div className="flex items-center gap-1.5 text-sm font-bold">
        <ShieldCheck size={15} /> {mode === 'cloud' ? 'Backed up to your account' : 'Stored on this device'}
      </div>
      <p className="mt-1 text-xs text-white/80">{mode === 'cloud' ? 'Available on all your devices, even offline.' : 'Export a backup regularly from Settings.'}</p>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [mobileSearch, setMobileSearch] = useState(false);
  const loc = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, which React would try to call as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/70 bg-white px-4 py-6 dark:border-white/5 dark:bg-ink-900 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-gradient-to-r from-brand-600 to-blue-600 text-white shadow-glow' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
                )
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <NavLink
          to="/import"
          className={({ isActive }) =>
            clsx('mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-slate-100 text-brand-700 dark:bg-white/10 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5')
          }
        >
          <FileUp size={18} /> Import data
        </NavLink>
        <SidebarCard />
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-[#f5f5fb]/85 dark:bg-ink-950/85 backdrop-blur-xl dark:border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <SearchBox className="hidden max-w-md flex-1 md:block" />
          <div className="ml-auto flex items-center gap-0.5">
            <button className="rounded-full p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 md:hidden" onClick={() => setMobileSearch(true)} aria-label="Search">
              <Search size={20} />
            </button>
            <SyncStatus />
            <Notifications />
            <ThemeToggle />
            <AccountButton />
          </div>
        </div>
        {mobileSearch && (
          <div className="absolute inset-x-0 top-0 z-30 flex h-16 items-center gap-2 bg-[#f5f5fb] px-4 dark:bg-ink-950 md:hidden">
            <SearchBox className="flex-1" autoFocus onDone={() => setMobileSearch(false)} />
            <button className="rounded-full p-2" onClick={() => setMobileSearch(false)} aria-label="Close search">
              <X size={20} />
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-32 pt-5 sm:px-6 lg:pb-12">
        <SyncErrorBanner />
        {children}
      </main>

      <Fab />

      {/* Mobile bottom nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/95 backdrop-blur-xl dark:border-white/5 dark:bg-ink-900/95 lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx('flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition', isActive ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={clsx('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-100 dark:bg-brand-500/20')}>
                    <n.icon size={19} />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
