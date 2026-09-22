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
          {title && <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>}
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
  const toneClasses: Record<string, string> = {
    primary: 'text-primary-600 bg-primary-50',
    success: 'text-success-600 bg-success-50',
    warning: 'text-warning-600 bg-warning-50',
    danger: 'text-danger-600 bg-danger-50',
    info: 'text-info-600 bg-info-50',
  };
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-2 inline-flex rounded-lg px-2 py-1 text-2xl font-bold ${toneClasses[tone]}`}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}
