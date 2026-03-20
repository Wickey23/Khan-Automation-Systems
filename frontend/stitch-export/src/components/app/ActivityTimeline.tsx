import React from 'react';
import { cn } from '@/src/lib/utils';
import { LucideIcon, PhoneCall, MessageSquare, Calendar, Zap, ShieldCheck, AlertCircle } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface ActivityItem {
  id: string;
  type: 'call' | 'sms' | 'booking' | 'system';
  title: string;
  description: string;
  timestamp: string;
  status: any; // StatusState
  icon?: LucideIcon;
}

interface ActivityTimelineProps {
  items: ActivityItem[];
  className?: string;
}

const activityIcons: Record<string, LucideIcon> = {
  call: PhoneCall,
  sms: MessageSquare,
  booking: Calendar,
  system: Zap,
};

export function ActivityTimeline({ items, className }: ActivityTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center bg-surface-container-low rounded-2xl border border-outline-variant/10">
        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap size={24} />
        </div>
        <h3 className="text-lg font-bold text-on-surface mb-1">No recent activity</h3>
        <p className="text-sm text-on-surface-variant">Activity will appear here as your workspace processes requests.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-outline-variant/20" />
        
        <div className="space-y-8">
          {items.map((item) => {
            const Icon = item.icon || activityIcons[item.type] || Zap;
            
            return (
              <div key={item.id} className="relative flex items-start gap-6 group">
                <div className={cn(
                  "relative z-10 w-12 h-12 rounded-xl flex items-center justify-center border-4 border-surface shadow-sm transition-transform group-hover:scale-110",
                  item.type === 'call' ? "bg-primary-container text-primary" : 
                  item.type === 'sms' ? "bg-indigo-100 text-indigo-600" : 
                  item.type === 'booking' ? "bg-emerald-100 text-emerald-600" : 
                  "bg-slate-100 text-slate-600"
                )}>
                  <Icon size={20} />
                </div>
                
                <div className="flex-grow pt-1">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-bold text-on-surface">{item.title}</h4>
                    <div className="flex items-center gap-3">
                      <StatusBadge type={item.type as any} state={item.status} />
                      <span className="text-[10px] font-bold text-outline uppercase tracking-widest">{item.timestamp}</span>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
