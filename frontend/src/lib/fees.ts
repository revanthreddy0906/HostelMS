import type { Fee } from '@/types';

export function periodLabel(period?: string | null) {
  if (!period) return '';
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function billLabel(f: Fee) {
  if (f.billtype === 'Deposit') return 'Security deposit';
  if (f.billtype === 'AC') return `AC electricity · ${periodLabel(f.period)}`;
  return `Rent · ${periodLabel(f.period)}`;
}
