import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger-600">{error}</span>}
    </label>
  );
}

const baseInput =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-100';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, className = '', ...rest }: TextFieldProps) {
  return (
    <Field label={label} error={error}>
      <input className={`${baseInput} ${className}`} {...rest} />
    </Field>
  );
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function TextareaField({ label, error, className = '', ...rest }: TextareaFieldProps) {
  return (
    <Field label={label} error={error}>
      <textarea className={`${baseInput} ${className}`} rows={3} {...rest} />
    </Field>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export function SelectField({ label, error, options, placeholder, className = '', ...rest }: SelectFieldProps) {
  return (
    <Field label={label} error={error}>
      <select className={`${baseInput} ${className}`} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
