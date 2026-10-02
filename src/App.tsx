import { Loader2 } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout, useIsDark, useReminders } from './components/Layout';
import { CloseLoanForm, ReminderSheet } from './components/forms/LoanActions';
import { LoanForm } from './components/forms/LoanForm';
import { InterestForm } from './components/forms/InterestForm';
import { NoteEntryForm, NoteForm, PlanForm, PlanPaymentForm } from './components/forms/NotesPlansForms';
import { RepaymentForm } from './components/forms/RepaymentForm';
import { TransactionForm } from './components/forms/TransactionForm';
import { ConfirmHost, Toaster } from './components/ui/Overlays';
import { lazyPage } from './lib/lazy';
import Login from './pages/Login';
import { startSession, useSession } from './store/useSession';
import { useStore } from './store/useStore';
import { useUI } from './store/useUI';
import { formatINR } from './lib/format';

const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const Transactions = lazyPage(() => import('./pages/Transactions'));
const Loans = lazyPage(() => import('./pages/Loans'));
const LoanDetail = lazyPage(() => import('./pages/LoanDetail'));
const Reports = lazyPage(() => import('./pages/Reports'));
const Search = lazyPage(() => import('./pages/Search'));
const Settings = lazyPage(() => import('./pages/Settings'));
const ImportData = lazyPage(() => import('./pages/Import'));
const MonthBook = lazyPage(() => import('./pages/MonthBook'));
const Notes = lazyPage(() => import('./pages/Notes'));
const NoteDetail = lazyPage(() => import('./pages/NoteDetail'));
const Investments = lazyPage(() => import('./pages/Investments'));
const PlanDetail = lazyPage(() => import('./pages/PlanDetail'));
const More = lazyPage(() => import('./pages/More'));

function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.close);
  if (!sheet) return null;
  const body = (() => {
    switch (sheet.kind) {
      case 'tx':
        return <TransactionForm key={sheet.editId ?? sheet.txType} txType={sheet.txType} editId={sheet.editId} defaultDate={sheet.defaultDate} onClose={close} />;
      case 'loan':
        return <LoanForm key={sheet.editId ?? 'new'} editId={sheet.editId} onClose={close} />;
      case 'repayment':
        return <RepaymentForm key={sheet.editId ?? 'new'} loanId={sheet.loanId} editId={sheet.editId} onClose={close} />;
      case 'interest':
        return <InterestForm loanId={sheet.loanId} onClose={close} />;
      case 'note':
        return <NoteForm key={sheet.editId ?? 'new'} editId={sheet.editId} onClose={close} />;
      case 'note-entry':
        return <NoteEntryForm key={sheet.editId ?? 'new'} noteId={sheet.noteId} editId={sheet.editId} entryType={sheet.entryType} onClose={close} />;
      case 'plan':
        return <PlanForm key={sheet.editId ?? 'new'} editId={sheet.editId} onClose={close} />;
      case 'plan-payment':
        return <PlanPaymentForm key={sheet.editId ?? 'new'} planId={sheet.planId} editId={sheet.editId} onClose={close} />;
      case 'close-loan':
        return <CloseLoanForm loanId={sheet.loanId} onClose={close} />;
      case 'reminder':
        return <ReminderSheet loanId={sheet.loanId} onClose={close} />;
    }
  })();
  return (
    <ErrorBoundary scope="this form" resetKey={JSON.stringify(sheet)}>
      {body}
    </ErrorBoundary>
  );
}

function useThemeClass() {
  const dark = useIsDark();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0b14' : '#6128f4');
  }, [dark]);
}

/** Once per session: a system notification for urgent loan reminders (if enabled). Never allowed to crash the app. */
function useBrowserNotifications() {
  const enabled = useStore((s) => s.settings.browserNotifications);
  const ready = useStore((s) => s.status === 'ready');
  const reminders = useReminders();
  useEffect(() => {
    if (!enabled || !ready) return;
    const urgent = reminders.filter((r) => r.kind === 'overdue' || r.kind === 'due-soon' || r.kind === 'pending');
    if (!urgent.length) return;
    (async () => {
      try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (sessionStorage.getItem('paisa-ledger:notified')) return;
        sessionStorage.setItem('paisa-ledger:notified', '1');
        const title = urgent.length === 1 ? urgent[0].title : `${urgent.length} loan reminders`;
        const options = { body: urgent.slice(0, 3).map((r) => r.title).join('\n'), icon: './icon.svg' };
        // Android Chrome only allows notifications via the service worker.
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) await reg.showNotification(title, options);
        else new Notification(title, options);
      } catch (e) {
        console.warn('Notification failed', e);
      }
    })();
  }, [enabled, ready, reminders]);
}

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Loader2 size={28} className="animate-spin text-brand-500" />
    </div>
  );
}

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
        <img src="./icon.svg" alt="" className="h-14 w-14 animate-pulse rounded-2xl" />
        {label}
      </div>
    </div>
  );
}

/** First sign-in on a device that already has data from before accounts existed. */
function MigrationPrompt() {
  const offer = useSession((s) => s.migrationOffer);
  const dismiss = useSession((s) => s.dismissMigration);
  const replaceAll = useStore((s) => s.replaceAll);
  const toast = useUI((s) => s.toast);
  const [busy, setBusy] = useState(false);
  if (!offer) return null;
  const total = offer.loans.reduce((a, l) => a + l.principal, 0);
  return (
    <div className="fixed inset-0 z-[65] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-ink-850">
        <h3 className="text-lg font-bold">Move your existing data to your account?</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          This device has <b>{offer.transactions.filter((t) => !t.deletedAt).length} transactions</b> and <b>{offer.loans.filter((l) => !l.deletedAt).length} loans</b> ({formatINR(total)} lent) saved from before you signed in.
          Upload them so they are backed up and available on every device.
        </p>
        <div className="mt-6 flex gap-2">
          <button className="btn-secondary flex-1" disabled={busy} onClick={dismiss}>
            Not now
          </button>
          <button
            className="btn-primary flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await replaceAll({ transactions: offer.transactions, loans: offer.loans, notes: offer.notes, plans: offer.plans, settings: offer.settings }, 'Uploaded data from this device');
                dismiss();
                toast('Your data is now saved to your account');
              } catch (e) {
                toast((e as Error).message || 'Upload failed — please retry', { tone: 'danger' });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />} Upload
          </button>
        </div>
      </div>
    </div>
  );
}

function RoutedApp() {
  const loc = useLocation();
  return (
    <Layout>
      <ErrorBoundary resetKey={loc.pathname}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/transactions/month/:ym" element={<MonthBook />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/loans/:id" element={<LoanDetail />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/notes/:id" element={<NoteDetail />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/investments/:id" element={<PlanDetail />} />
            <Route path="/more" element={<More />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/search" element={<Search />} />
            <Route path="/import" element={<ImportData />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  useThemeClass();
  useBrowserNotifications();
  const status = useSession((s) => s.status);
  const dataStatus = useStore((s) => s.status);
  useEffect(() => {
    startSession();
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  let body;
  if (status === 'starting') body = <FullScreenLoader label="Starting…" />;
  else if (status === 'signed-out') body = <Login />;
  else if (dataStatus !== 'ready') body = <FullScreenLoader label="Loading your data…" />;
  else
    body = (
      <HashRouter>
        <RoutedApp />
        <SheetHost />
        <MigrationPrompt />
      </HashRouter>
    );

  return (
    <ErrorBoundary scope="the app" fullScreen>
      {body}
      <ConfirmHost />
      <Toaster />
    </ErrorBoundary>
  );
}
