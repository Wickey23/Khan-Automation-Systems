import React from 'react';
import { cn } from '@/src/lib/utils';
import { LucideIcon, AlertCircle, CheckCircle2, Lock, Info, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StateCardProps {
  type: 'loading' | 'empty' | 'error' | 'locked' | 'setup-required';
  title: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  onRetry?: () => void;
  className?: string;
}

export function StateCard({ 
  type, 
  title, 
  description, 
  ctaText, 
  ctaHref, 
  onRetry, 
  className 
}: StateCardProps) {
  const icons: Record<string, LucideIcon> = {
    loading: RefreshCcw,
    empty: Info,
    error: AlertCircle,
    locked: Lock,
    'setup-required': CheckCircle2,
  };

  const Icon = icons[type];

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center p-12 bg-surface-container-low rounded-2xl border border-outline-variant/10",
      className
    )}>
      <div className={cn(
        "w-16 h-16 rounded-full flex items-center justify-center mb-6",
        type === 'error' ? "bg-rose-100 text-rose-600" : 
        type === 'locked' ? "bg-slate-100 text-slate-600" : 
        type === 'setup-required' ? "bg-amber-100 text-amber-600" : 
        "bg-primary-container text-primary"
      )}>
        <Icon size={32} className={cn(type === 'loading' && "animate-spin")} />
      </div>
      <h3 className="text-xl font-bold text-on-surface mb-2">{title}</h3>
      <p className="text-on-surface-variant text-sm max-w-md mb-8 leading-relaxed">
        {description}
      </p>
      
      <div className="flex gap-4">
        {onRetry && (
          <button 
            onClick={onRetry}
            className="px-6 py-2.5 bg-surface-container-highest text-on-surface font-bold text-sm rounded-lg hover:bg-surface-container-high transition-colors"
          >
            Retry
          </button>
        )}
        {ctaText && ctaHref && (
          <Link 
            to={ctaHref}
            className="px-6 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-lg shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
          >
            {ctaText}
          </Link>
        )}
      </div>
    </div>
  );
}
