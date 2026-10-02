import { CheckCircle2, Download, Share, WifiOff } from 'lucide-react';
import { useInstall } from '../lib/install';

/** "Install app" with the browser's own prompt, or simple instructions where that isn't available. */
export function InstallCard() {
  const { canInstall, installed, ios, install } = useInstall();
  return (
    <div className="space-y-3">
      {installed ? (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={18} /> Installed. Open Paisa Ledger from your home screen or app list.
        </p>
      ) : canInstall ? (
        <button className="btn-primary w-full py-3" onClick={() => install()}>
          <Download size={18} /> Install app on this device
        </button>
      ) : ios ? (
        <p className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5">
          On iPhone/iPad (Safari): tap <Share size={14} className="inline" /> <b>Share</b> → <b>Add to Home Screen</b>.
        </p>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5">
          <b>Chrome / Edge:</b> click the install icon in the address bar, or menu <b>⋮ / …</b> → <b>Apps → Install Paisa Ledger</b>.<br />
          <b>Android:</b> menu ⋮ → <b>Install app</b> / <b>Add to Home screen</b>.
        </p>
      )}
      <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <WifiOff size={14} className="mt-0.5 shrink-0" /> Works offline: the app opens without internet, and entries you add offline are saved on the device and sync automatically when you're back online.
      </p>
    </div>
  );
}
