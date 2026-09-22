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
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              'rounded-lg px-4 py-3 shadow-lg text-sm font-medium border animate-[fadein_.15s_ease-out] ' +
              (t.kind === 'success'
                ? 'bg-success-50 border-success-600/30 text-success-700'
                : t.kind === 'error'
                  ? 'bg-danger-50 border-danger-600/30 text-danger-700'
                  : 'bg-info-50 border-info-600/30 text-info-700')
            }
          >
            <div className="flex items-start justify-between gap-3">
              <span>{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="text-neutral-400 hover:text-neutral-700 leading-none"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
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
