import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
  showError: (err: unknown, fallback?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  const showError = useCallback(
    (err: unknown, fallback = 'Something went wrong') => {
      const message = err instanceof ApiError ? err.message : fallback;
      showToast(message, 'error');
    },
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, showError }}>
      {children}
      {/* Bottom-right, compact and stacked so toasts never cover page-header actions. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col items-end gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3.5 py-3 text-sm shadow-lg"
          >
            <span
              className={
                'mt-1.5 h-2 w-2 shrink-0 rounded-full ' +
                (t.kind === 'success' ? 'bg-success-600' : t.kind === 'error' ? 'bg-danger-600' : 'bg-info-600')
              }
              aria-hidden="true"
            />
            <span className="flex-1 text-neutral-800">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="rounded p-0.5 text-neutral-500 transition-colors duration-150 ease-out hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
