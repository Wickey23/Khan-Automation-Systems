"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface StatusStripProps {
  progress: number; // 0-100
  isLive: boolean;
  isProvenLive: boolean;
  message: string;
  className?: string;
}

export function StatusStrip({ 
  progress, 
  isLive, 
  isProvenLive, 
  message, 
  className 
}: StatusStripProps) {
  const isIncomplete = progress < 100;

  return (
    <div className={cn(
      "flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-3 rounded-xl border border-outline-variant/15 shadow-sm",
      isIncomplete ? "bg-amber-50/50 border-amber-200/50" : "bg-surface-container-low",
      className
    )}>
      <div className="flex items-center gap-4 w-full md:w-auto">
        <div className="flex items-center gap-2">
          {isProvenLive ? (
            <ShieldCheck size={20} className="text-primary" />
          ) : isLive ? (
            <CheckCircle2 size={20} className="text-emerald-500" />
          ) : (
            <AlertTriangle size={20} className="text-amber-500" />
          )}
          <StatusBadge 
            type="readiness" 
            state={isProvenLive ? 'proven-live' : isLive ? 'live' : 'setup-required'} 
          />
        </div>
        
        <div className="h-4 w-px bg-outline-variant/20 hidden md:block" />
        
        <p className="text-sm font-medium text-on-surface leading-tight">
          {message}
        </p>
      </div>

      <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
        {isIncomplete && (
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-amber-200/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 transition-all duration-1000" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-amber-700">{progress}%</span>
          </div>
        )}

        {isIncomplete ? (
          <Link 
            href="/app/activation"
            className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:underline group"
          >
            Complete Setup
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <Link 
            href="/app/settings"
            className="text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Workspace Settings
          </Link>
        )}
      </div>
    </div>
  );
}
