import { create } from 'zustand';
import type { TxType } from '../types';
import { uid } from '../lib/format';

export type SheetState =
  | { kind: 'tx'; txType: TxType; editId?: string; defaultDate?: string }
  | { kind: 'loan'; editId?: string }
  | { kind: 'repayment'; loanId: string; editId?: string }
  | { kind: 'interest'; loanId: string }
  | { kind: 'close-loan'; loanId: string }
  | { kind: 'reminder'; loanId: string }
  | null;

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'danger';
  action?: { label: string; run: () => void };
}

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** When set, the user must type this text to enable the confirm button. */
  typeToConfirm?: string;
  resolve: (ok: boolean) => void;
}

interface UIState {
  sheet: SheetState;
  open: (s: SheetState) => void;
  close: () => void;
  toasts: Toast[];
  toast: (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;
  dismissToast: (id: string) => void;
  confirmReq: ConfirmRequest | null;
  confirm: (req: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;
}

export const useUI = create<UIState>()((set, get) => ({
  sheet: null,
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
  toasts: [],
  toast: (message, opts = {}) => {
    const t: Toast = { id: uid(), message, tone: opts.tone ?? 'success', action: opts.action };
    set((s) => ({ toasts: [...s.toasts.slice(-2), t] }));
    setTimeout(() => get().dismissToast(t.id), opts.action ? 6000 : 3000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  confirmReq: null,
  confirm: (req) => new Promise<boolean>((resolve) => set({ confirmReq: { ...req, resolve } })),
  resolveConfirm: (ok) => {
    get().confirmReq?.resolve(ok);
    set({ confirmReq: null });
  },
}));
