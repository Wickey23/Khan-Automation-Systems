import React from 'react';
import { cn } from '@/src/lib/utils';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href: string }[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ 
  title, 
  description, 
  breadcrumbs, 
  actions, 
  className 
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4 mb-8", className)}>
      {breadcrumbs && (
        <nav className="flex items-center gap-2 text-xs font-bold text-outline uppercase tracking-widest">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.href}>
              <Link to={crumb.href} className="hover:text-on-surface transition-colors">
                {crumb.label}
              </Link>
              {i < breadcrumbs.length - 1 && <ChevronRight size={12} />}
            </React.Fragment>
          ))}
        </nav>
      )}
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">{title}</h1>
          {description && <p className="text-on-surface-variant text-sm font-medium">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
