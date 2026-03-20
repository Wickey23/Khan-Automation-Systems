import React from 'react';
import { cn } from '@/src/lib/utils';

type StatusType = 
  | 'calls' 
  | 'sms' 
  | 'booking' 
  | 'access' 
  | 'readiness' 
  | 'queue' 
  | 'runtime';

type StatusState = 
  | 'missed' | 'answered' | 'in-progress' 
  | 'sent' | 'received' | 'pending' 
  | 'confirmed' | 'cancelled' 
  | 'live' | 'proven-live' | 'setup-required' | 'locked'
  | 'active' | 'inactive' | 'error';

interface StatusBadgeProps {
  type: StatusType;
  state: StatusState;
  className?: string;
}

const statusStyles: Record<StatusState, string> = {
  'missed': 'bg-rose-100 text-rose-700 border-rose-200',
  'answered': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'in-progress': 'bg-amber-100 text-amber-700 border-amber-200',
  'sent': 'bg-blue-100 text-blue-700 border-blue-200',
  'received': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'pending': 'bg-slate-100 text-slate-700 border-slate-200',
  'confirmed': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'cancelled': 'bg-rose-100 text-rose-700 border-rose-200',
  'live': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'proven-live': 'bg-primary-container text-primary border-primary/20',
  'setup-required': 'bg-amber-100 text-amber-700 border-amber-200',
  'locked': 'bg-slate-200 text-slate-600 border-slate-300',
  'active': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'inactive': 'bg-slate-100 text-slate-700 border-slate-200',
  'error': 'bg-rose-100 text-rose-700 border-rose-200',
};

const statusLabels: Record<StatusState, string> = {
  'missed': 'Missed',
  'answered': 'Answered',
  'in-progress': 'In Progress',
  'sent': 'Sent',
  'received': 'Received',
  'pending': 'Pending',
  'confirmed': 'Confirmed',
  'cancelled': 'Cancelled',
  'live': 'Live',
  'proven-live': 'Proven Live',
  'setup-required': 'Setup Required',
  'locked': 'Locked',
  'active': 'Active',
  'inactive': 'Inactive',
  'error': 'Error',
};

export function StatusBadge({ type, state, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      statusStyles[state],
      className
    )}>
      {statusLabels[state]}
    </span>
  );
}
