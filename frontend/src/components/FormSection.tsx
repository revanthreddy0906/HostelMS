import type { ReactNode } from 'react';

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
