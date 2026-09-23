import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Card({ title, actions, children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${className}`}
      {...rest}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
          {title && <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'primary',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const dotClasses: Record<string, string> = {
    primary: 'bg-primary-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    danger: 'bg-danger-600',
    info: 'bg-info-600',
  };
  const valueClasses: Record<string, string> = {
    primary: 'text-neutral-900',
    success: 'text-success-700',
    warning: 'text-warning-700',
    danger: 'text-danger-700',
    info: 'text-info-700',
  };
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-600">
        <span className={`h-2 w-2 rounded-full ${dotClasses[tone]}`} aria-hidden="true" />
        {label}
      </div>
      <div className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${valueClasses[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}
