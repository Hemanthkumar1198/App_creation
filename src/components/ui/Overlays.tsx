import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useState } from 'react';
import { useUI } from '../../store/useUI';

export function ConfirmHost() {
  const req = useUI((s) => s.confirmReq);
  const resolve = useUI((s) => s.resolveConfirm);
  const [typed, setTyped] = useState('');
  if (!req) return null;
  const blocked = !!req.typeToConfirm && typed.trim() !== req.typeToConfirm;
  const done = (ok: boolean) => {
    setTyped('');
    resolve(ok);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => done(false)} />
      <div className="animate-slide-up relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-ink-850">
        <div className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl ${req.danger ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'}`}>
          <AlertTriangle size={22} />
        </div>
        <h3 className="text-lg font-bold">{req.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{req.message}</p>
        {req.typeToConfirm && (
          <div className="mt-4">
            <label className="label">
              Type <span className="font-mono normal-case text-rose-600">{req.typeToConfirm}</span> to confirm
            </label>
            <input className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}
        <div className="mt-6 flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => done(false)}>
            Cancel
          </button>
          <button className={`${req.danger ? 'btn-danger' : 'btn-primary'} flex-1`} disabled={blocked} onClick={() => done(true)} autoFocus={!req.typeToConfirm}>
            {req.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => {
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'danger' ? AlertTriangle : Info;
        return (
          <div key={t.id} className="animate-slide-up pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl dark:bg-white dark:text-slate-900">
            <Icon size={18} className={t.tone === 'success' ? 'text-emerald-400 dark:text-emerald-600' : t.tone === 'danger' ? 'text-rose-400 dark:text-rose-600' : 'text-brand-300 dark:text-brand-600'} />
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                className="rounded-lg px-2 py-1 font-semibold text-brand-300 hover:bg-white/10 dark:text-brand-600 dark:hover:bg-slate-100"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
