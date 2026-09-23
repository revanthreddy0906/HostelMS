import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-300',
  secondary:
    'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 focus-visible:ring-neutral-300',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-100',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 focus-visible:ring-neutral-200',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium shadow-sm transition-colors duration-150 ease-out ' +
        'disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
        variantClasses[variant] +
        ' ' +
        sizeClasses[size] +
        ' ' +
        className
      }
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
