import React from 'react';
import { cn } from '@/src/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("min-h-screen bg-surface flex flex-col", className)}>
      {children}
    </div>
  );
}

interface SectionShellProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function SectionShell({ children, className, title, description }: SectionShellProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h2 className="text-lg font-bold tracking-tight text-on-surface">{title}</h2>}
          {description && <p className="text-sm text-on-surface-variant font-body">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
