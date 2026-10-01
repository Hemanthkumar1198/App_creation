import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'paisa-ledger:chunk-reload';

/**
 * React.lazy with recovery: after a new deploy, an open tab may request page
 * chunks that no longer exist. Retry once, then reload the page a single time
 * to pick up the new version instead of showing a blank screen.
 */
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch {
      try {
        return await load();
      } catch (err) {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
          return new Promise<never>(() => undefined);
        }
        throw err;
      }
    }
  });
}
