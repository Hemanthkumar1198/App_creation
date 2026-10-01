import { ArrowLeft, Loader2, LockKeyhole, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { toE164 } from '../lib/phone';
import { friendlyError, resetVerifier, sendOtp, signInWithGoogle } from '../store/useSession';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const [mode, setMode] = useState<'choose' | 'phone' | 'otp'>('choose');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'' | 'google' | 'send' | 'verify'>('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const confirmation = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => () => resetVerifier(), []);

  const google = async () => {
    setError('');
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy('');
    }
  };

  const send = async () => {
    setError('');
    const e164 = toE164(phone);
    if (!e164) return setError('Enter a valid mobile number, e.g. 98765 43210');
    setBusy('send');
    try {
      confirmation.current = await sendOtp(e164, 'recaptcha-container');
      setMode('otp');
      setCode('');
      setCooldown(30);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy('');
    }
  };

  const verify = async () => {
    setError('');
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit OTP');
    if (!confirmation.current) return setMode('phone');
    setBusy('verify');
    try {
      await confirmation.current.confirm(code);
    } catch (e) {
      setError(friendlyError(e));
      setBusy('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-blue-600 p-4 dark:from-ink-950 dark:via-brand-900 dark:to-ink-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <img src="./icon.svg" alt="" className="h-16 w-16 rounded-2xl shadow-2xl" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Paisa Ledger</h1>
          <p className="mt-1 text-white/80">Your money and the loans you've given, in one safe place.</p>
        </div>

        <div className="animate-slide-up rounded-3xl bg-white p-6 shadow-2xl dark:bg-ink-850 sm:p-8">
          {mode === 'choose' && (
            <>
              <h2 className="text-xl font-bold">Sign in or create an account</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your data is saved securely to your account and available on all your devices.</p>
              <div className="mt-6 space-y-3">
                <button className="btn-secondary w-full py-3 text-base" onClick={google} disabled={!!busy}>
                  {busy === 'google' ? <Loader2 size={20} className="animate-spin" /> : <GoogleIcon />} Continue with Google
                </button>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                </div>
                <button className="btn-primary w-full py-3 text-base" onClick={() => setMode('phone')} disabled={!!busy}>
                  <Smartphone size={20} /> Continue with mobile number
                </button>
              </div>
            </>
          )}

          {mode === 'phone' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <button type="button" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500" onClick={() => setMode('choose')}>
                <ArrowLeft size={16} /> Back
              </button>
              <h2 className="text-xl font-bold">Your mobile number</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">We'll send a 6-digit OTP by SMS.</p>
              <div className="mt-5 flex items-center rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15 dark:border-white/10">
                <span className="border-r border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-500 dark:border-white/10">+91</span>
                <input
                  autoFocus
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  className="w-full bg-transparent px-3.5 py-3 text-base outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary mt-4 w-full py-3" disabled={busy === 'send'}>
                {busy === 'send' && <Loader2 size={18} className="animate-spin" />} Send OTP
              </button>
            </form>
          )}

          {mode === 'otp' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
            >
              <button type="button" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500" onClick={() => setMode('phone')}>
                <ArrowLeft size={16} /> Change number
              </button>
              <h2 className="text-xl font-bold">Enter OTP</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sent to {toE164(phone)}</p>
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                className="input num mt-5 text-center text-2xl font-bold tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button type="submit" className="btn-primary mt-4 w-full py-3" disabled={busy === 'verify'}>
                {busy === 'verify' && <Loader2 size={18} className="animate-spin" />} Verify & sign in
              </button>
              <button type="button" className="btn-ghost mt-2 w-full" disabled={cooldown > 0 || busy === 'send'} onClick={send}>
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
              </button>
            </form>
          )}

          {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
          <div id="recaptcha-container" />

          <div className="mt-6 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>
              Passwordless and secure. Your records are private to your account. No one else, including other users, can read them.
            </span>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/70">
          <LockKeyhole size={12} /> Encrypted connection (HTTPS)
        </p>
      </div>
    </div>
  );
}
