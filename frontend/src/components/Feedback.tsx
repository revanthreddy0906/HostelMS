/**
 * Shared empty-state and loading-state presentation. Use these instead of
 * ad-hoc "Loading…" / "No records found" strings so every page reads
 * identically.
 */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-neutral-500">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title = 'No records found',
  hint,
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
      <p className="text-sm font-medium text-neutral-600">{title}</p>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
