import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Tracks whether the app can be installed (Chrome/Edge/Android) or already is. */
export const useInstall = create<{ canInstall: boolean; installed: boolean; ios: boolean; install: () => Promise<boolean> }>()((set) => ({
  canInstall: false,
  installed: typeof window !== 'undefined' && standalone(),
  ios: typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent),
  install: async () => {
    const e = deferred;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null;
    set({ canInstall: false, installed: outcome === 'accepted' });
    return outcome === 'accepted';
  },
}));

let deferred: BeforeInstallPromptEvent | null = null;

export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    useInstall.setState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    useInstall.setState({ canInstall: false, installed: true });
  });
}
