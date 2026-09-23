import type { ReactNode } from 'react';

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/50 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-lg ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-neutral-500 transition-colors duration-150 ease-out hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
