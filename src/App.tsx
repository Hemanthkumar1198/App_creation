import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout, useIsDark, useReminders } from './components/Layout';
import { CloseLoanForm, ReminderSheet } from './components/forms/LoanActions';
import { LoanForm } from './components/forms/LoanForm';
import { RepaymentForm } from './components/forms/RepaymentForm';
import { TransactionForm } from './components/forms/TransactionForm';
import { ConfirmHost, Toaster } from './components/ui/Overlays';
import Dashboard from './pages/Dashboard';
import LoanDetail from './pages/LoanDetail';
import Loans from './pages/Loans';
import Reports from './pages/Reports';
import Search from './pages/Search';
import Settings from './pages/Settings';
import Transactions from './pages/Transactions';
import { runDailyAutoBackup, useStore } from './store/useStore';
import { useUI } from './store/useUI';

function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.close);
  if (!sheet) return null;
  switch (sheet.kind) {
    case 'tx':
      return <TransactionForm key={sheet.editId ?? sheet.txType} txType={sheet.txType} editId={sheet.editId} onClose={close} />;
    case 'loan':
      return <LoanForm key={sheet.editId ?? 'new'} editId={sheet.editId} onClose={close} />;
    case 'repayment':
      return <RepaymentForm key={sheet.editId ?? 'new'} loanId={sheet.loanId} editId={sheet.editId} onClose={close} />;
    case 'close-loan':
      return <CloseLoanForm loanId={sheet.loanId} onClose={close} />;
    case 'reminder':
      return <ReminderSheet loanId={sheet.loanId} onClose={close} />;
  }
}

function useThemeClass() {
  const dark = useIsDark();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0b14' : '#6128f4');
  }, [dark]);
}

/** Once per session: fire a system notification for urgent loan reminders (if enabled). */
function useBrowserNotifications() {
  const enabled = useStore((s) => s.settings.browserNotifications);
  const reminders = useReminders();
  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (sessionStorage.getItem('paisa-ledger:notified')) return;
    const urgent = reminders.filter((r) => r.kind === 'overdue' || r.kind === 'due-soon' || r.kind === 'pending');
    if (!urgent.length) return;
    sessionStorage.setItem('paisa-ledger:notified', '1');
    new Notification(urgent.length === 1 ? urgent[0].title : `${urgent.length} loan reminders`, {
      body: urgent.slice(0, 3).map((r) => r.title).join('\n'),
      icon: './icon.svg',
    });
  }, [enabled, reminders]);
}

export default function App() {
  useThemeClass();
  useBrowserNotifications();
  useEffect(() => {
    runDailyAutoBackup();
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/loans/:id" element={<LoanDetail />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <SheetHost />
      <ConfirmHost />
      <Toaster />
    </HashRouter>
  );
}
