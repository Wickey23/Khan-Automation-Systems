"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  LucideIcon, 
  ShieldAlert, 
  CreditCard, 
  Settings, 
  PhoneCall, 
  MessageSquare, 
  Calendar 
} from 'lucide-react';
import Link from "next/link";

type Priority = 'high' | 'medium' | 'low';

interface AttentionItem {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  icon: LucideIcon;
  ctaText: string;
  ctaHref: string;
  type: 'blocked' | 'review' | 'setup';
}

interface NeedsAttentionProps {
  items: AttentionItem[];
  className?: string;
}

export function NeedsAttention({ items, className }: NeedsAttentionProps) {
  if (items.length === 0) {
    return (
      <div className="bg-surface-container-low p-12 rounded-2xl border border-outline-variant/10 text-center">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={24} />
        </div>
        <h3 className="text-lg font-bold text-on-surface mb-1">All clear</h3>
        <p className="text-sm text-on-surface-variant">No items require your immediate attention.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => (
        <div 
          key={item.id}
          className={cn(
            "flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-xl border transition-all hover:shadow-md",
            item.priority === 'high' ? "bg-rose-50/50 border-rose-200/50" : 
            item.priority === 'medium' ? "bg-amber-50/50 border-amber-200/50" : 
            "bg-surface-container-low border-outline-variant/10"
          )}
        >
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              item.priority === 'high' ? "bg-rose-100 text-rose-600" : 
              item.priority === 'medium' ? "bg-amber-100 text-amber-600" : 
              "bg-surface-container-high text-on-surface-variant"
            )}>
              <item.icon size={20} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-on-surface">{item.title}</h4>
                {item.priority === 'high' && (
                  <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[8px] font-bold uppercase rounded tracking-widest">Critical</span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed max-w-lg">
                {item.description}
              </p>
            </div>
          </div>

          <Link 
            href={item.ctaHref}
            className={cn(
              "flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-all group w-full md:w-auto justify-center",
              item.priority === 'high' ? "bg-rose-600 text-white hover:bg-rose-700" : 
              item.priority === 'medium' ? "bg-amber-600 text-white hover:bg-amber-700" : 
              "bg-surface-container-highest text-on-surface hover:bg-surface-container-high"
            )}
          >
            {item.ctaText}
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      ))}
    </div>
  );
}
