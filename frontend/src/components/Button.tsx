import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as UiButton } from '@/components/ui/button';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT = { primary: 'default', secondary: 'outline', danger: 'destructive', ghost: 'ghost' } as const;
const SIZE = { sm: 'sm', md: 'lg' } as const;

export function Button({ variant = 'primary', size = 'md', loading = false, disabled, children, ...rest }: ButtonProps) {
  return (
    <UiButton variant={VARIANT[variant]} size={SIZE[size]} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </UiButton>
  );
}
