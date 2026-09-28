import type { HTMLAttributes, ReactNode } from 'react';
import { Card as UiCard, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Card({ title, description, actions, children, className, ...rest }: CardProps) {
  return (
    <UiCard className={className} {...rest}>
      {(title || actions) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {actions && <CardAction className="flex items-center gap-2">{actions}</CardAction>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </UiCard>
  );
}

const TONE_DOT: Record<string, string> = {
  primary: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
};

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
  return (
    <UiCard className="gap-2">
      <CardContent>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className={cn('size-2 rounded-full', TONE_DOT[tone])} aria-hidden="true" />
          {label}
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </UiCard>
  );
}
