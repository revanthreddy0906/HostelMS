import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { NumberTicker } from '@/components/ui/number-ticker';
import { cn } from '@/lib/utils';

export function useReduceMotion(): boolean {
  return !!useReducedMotion();
}

export function DashboardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="animate-in fade-in duration-300">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {subtitle} · {today}
      </p>
    </div>
  );
}

export function Stat({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const reduceMotion = useReduceMotion();
  return (
    <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
      {prefix}
      {reduceMotion ? value.toLocaleString('en-IN') : <NumberTicker value={value} className="tracking-tight text-foreground" />}
      {suffix}
    </span>
  );
}

type Tone = 'primary' | 'warning' | 'danger' | 'success';

const TONE_ICON: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  success: 'bg-emerald-100 text-emerald-700',
};

export function KpiCard({
  title,
  icon: Icon,
  to,
  loading,
  tone = 'primary',
  children,
  footer,
}: {
  title: string;
  icon: LucideIcon;
  to?: string;
  loading: boolean;
  tone?: Tone;
  children: ReactNode;
  footer: ReactNode;
}) {
  const card = (
    <Card className={cn('h-full gap-3', to && 'transition-shadow duration-150 ease-out group-hover:shadow-md')}>
      <CardHeader>
        <CardDescription className="font-medium text-muted-foreground">{title}</CardDescription>
        <CardAction>
          <span className={cn('flex size-8 items-center justify-center rounded-md', TONE_ICON[tone])}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? <Skeleton className="h-9 w-20" /> : children}
        <div className="text-xs text-muted-foreground">{loading ? <Skeleton className="h-3 w-32" /> : footer}</div>
      </CardContent>
    </Card>
  );
  if (!to) return card;
  return (
    <Link to={to} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
