import { create } from 'zustand';
import type { ThemeMode } from '../types';
import { THEME_KEY } from './useStore';

function read(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

/** Theme is a per-device preference, available before sign-in. */
export const useTheme = create<{ theme: ThemeMode; setTheme: (t: ThemeMode) => void }>()((set) => ({
  theme: read(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },
}));
