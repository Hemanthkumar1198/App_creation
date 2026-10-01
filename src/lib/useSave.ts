import { useCallback, useRef, useState } from 'react';
import type { CommitResult } from '../store/backend';
import { friendlyError } from '../store/useSession';
import { useUI } from '../store/useUI';

/**
 * Runs a save action once at a time (prevents double submits), shows a clear
 * success / offline / error notification, and reports whether it succeeded.
 */
export function useSave() {
  const toast = useUI((s) => s.toast);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const run = useCallback(
    async (action: () => Promise<CommitResult | { result: CommitResult }>, successMsg: string, opts: { undo?: () => void } = {}): Promise<boolean> => {
      if (busy.current) return false;
      busy.current = true;
      setSaving(true);
      try {
        const out = await action();
        const result = typeof out === 'string' ? out : out.result;
        if (result === 'queued') toast(`${successMsg} — saved offline, will sync when you're online`, { tone: 'info' });
        else toast(successMsg, { action: opts.undo ? { label: 'Undo', run: opts.undo } : undefined });
        return true;
      } catch (e) {
        toast(friendlyError(e), { tone: 'danger', action: { label: 'Retry', run: () => void run(action, successMsg, opts) } });
        return false;
      } finally {
        busy.current = false;
        setSaving(false);
      }
    },
    [toast],
  );

  return { saving, run };
}
