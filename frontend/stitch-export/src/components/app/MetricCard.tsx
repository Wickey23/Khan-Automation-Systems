import React from 'react';
import { cn } from '@/src/lib/utils';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isUp: boolean;
  };
  href: string;
  status?: 'loading' | 'empty' | 'error' | 'locked';
  statusMessage?: string;
}

export function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  href, 
  status, 
  statusMessage 
}: MetricCardProps) {
  if (status === 'loading') {
    return (
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 animate-pulse">
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 bg-surface-container-high rounded-lg" />
          <div className="w-16 h-4 bg-surface-container-high rounded" />
        </div>
        <div className="w-24 h-8 bg-surface-container-high rounded mb-2" />
        <div className="w-32 h-4 bg-surface-container-high rounded" />
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 opacity-75 relative overflow-hidden group">
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 bg-surface-container-high rounded-lg flex items-center justify-center text-on-surface-variant">
            <Icon size={20} />
          </div>
          <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Locked</span>
        </div>
        <h3 className="text-sm font-bold text-on-surface-variant mb-1">{title}</h3>
        <p className="text-xs text-outline font-medium">{statusMessage || 'Setup required'}</p>
        <Link to="/app/activation" className="absolute inset-0 z-10" />
      </div>
    );
  }

  return (
    <Link 
      to={href}
      className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 hover:shadow-lg hover:shadow-primary/5 transition-all group active:scale-[0.98]"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 bg-primary-container text-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
          <Icon size={20} />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-bold",
            trend.isUp ? "text-emerald-600" : "text-rose-600"
          )}>
            {trend.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-on-surface-variant">{title}</p>
        <h3 className="text-3xl font-extrabold text-on-surface tracking-tight">{value}</h3>
      </div>
    </Link>
  );
}
