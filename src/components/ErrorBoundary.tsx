import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown in the fallback, e.g. "this page". */
  scope?: string;
  /** Changing this key resets the boundary (e.g. the current route). */
  resetKey?: string;
  fullScreen?: boolean;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so one broken component never blanks the whole app.
 * The boundary resets automatically when the user navigates (resetKey changes).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Paisa Ledger] UI error:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className={this.props.fullScreen ? 'grid min-h-screen place-items-center p-6' : 'py-10'}>
        <div className="card mx-auto max-w-md p-6 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertTriangle size={22} />
          </div>
          <h2 className="text-lg font-bold">Something went wrong on {this.props.scope ?? 'this page'}</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Your data is safe. Try again, or go back to the dashboard.</p>
          <pre className="mt-4 max-h-24 overflow-auto rounded-xl bg-slate-50 p-2 text-left text-[11px] text-slate-500 dark:bg-white/5">{error.message}</pre>
          <div className="mt-5 flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => this.setState({ error: null })}>
              <RotateCcw size={16} /> Try again
            </button>
            <a className="btn-primary flex-1" href="#/" onClick={() => this.setState({ error: null })}>
              <Home size={16} /> Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
