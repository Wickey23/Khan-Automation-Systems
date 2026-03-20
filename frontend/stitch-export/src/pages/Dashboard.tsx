import React from 'react';
import { 
  Phone, 
  PhoneMissed, 
  MessageSquare, 
  CalendarCheck, 
  TrendingUp, 
  AlertCircle, 
  History,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

const metrics = [
  { label: 'Total Calls', value: '1,284', trend: '7-Day Trend', icon: Phone, color: 'primary' },
  { label: 'Missed Calls', value: '42', trend: '+12%', icon: PhoneMissed, color: 'error' },
  { label: 'Active Conversations', value: '18', trend: 'Live', icon: MessageSquare, color: 'secondary' },
  { label: 'New Bookings', value: '156', trend: 'New', icon: CalendarCheck, color: 'tertiary' },
];

const activities = [
  { title: 'Answered Call from John Smith', status: 'answered', time: '2 hours ago', detail: 'Duration: 12m 45s • Outcome: Consultation Scheduled' },
  { title: 'Booking Requested by Sarah Jones', status: 'requested', time: 'Yesterday, 4:15 PM', detail: 'Service: AC Repair • Priority: Regular' },
  { title: 'SMS Sent to Mike Doe', status: 'confirmed', time: 'Oct 24, 10:30 AM', detail: 'Type: Appointment Confirmation • Delivery: Verified' },
  { title: 'Unanswered Call (No Voicemail)', status: 'missed', time: 'Oct 23, 09:12 AM', detail: 'From: +1 (555) 0192 • System attempted AI redirect.' },
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Operational Pulse</h1>
          <p className="text-on-surface-variant text-sm">Real-time system performance and volume.</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 bg-surface-container-highest text-on-surface-variant rounded">Live View</span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface-container-lowest p-5 rounded-xl transition-all hover:bg-surface-container-low group card-shadow">
            <div className="flex justify-between items-start mb-4">
              <span className={cn(
                "p-2 rounded-lg",
                metric.color === 'primary' && "bg-primary-container/30 text-primary",
                metric.color === 'error' && "bg-error-container/20 text-error",
                metric.color === 'secondary' && "bg-secondary-container/30 text-secondary",
                metric.color === 'tertiary' && "bg-tertiary-container/40 text-tertiary",
              )}>
                <metric.icon size={20} />
              </span>
              <div className="flex flex-col items-end">
                <span className={cn(
                  "text-[10px] font-bold tracking-wider uppercase",
                  metric.color === 'error' ? "text-error" : "text-primary"
                )}>{metric.trend}</span>
                {metric.label === 'Total Calls' && (
                  <div className="flex items-end gap-[2px] h-6 mt-1">
                    {[2, 3, 5, 3, 4, 6, 5].map((h, i) => (
                      <div key={i} className="w-1 bg-primary/40 rounded-t-sm" style={{ height: `${h * 4}px` }}></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wider">{metric.label}</p>
            <h3 className="text-2xl font-bold mt-1">{metric.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-5 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Attention Center</h2>
            <p className="text-on-surface-variant text-sm">Actionable critical system alerts.</p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-white/60 backdrop-blur-md border border-white/40 p-5 rounded-xl flex items-start gap-4 shadow-sm hover:shadow-md transition-all">
              <AlertCircle className="text-error" size={24} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-on-surface">1 Failed Booking Sync</h4>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-error/10 text-error uppercase">Critical</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">Integration with Google Calendar timed out for client #8842.</p>
                <button className="mt-3 text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                  Retry Connection <ArrowRight size={14} />
                </button>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-md border border-white/40 p-5 rounded-xl flex items-start gap-4 shadow-sm hover:shadow-md transition-all">
              <History className="text-secondary" size={24} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-on-surface">2 Missed Calls Pending</h4>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container uppercase">Processing</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">System attempted callback 2x. Requires manual outreach.</p>
                <button className="mt-3 text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                  Open Call Log <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Recent Activity</h2>
              <p className="text-on-surface-variant text-sm">System events from the last 7 days.</p>
            </div>
            <button className="text-xs font-semibold text-primary hover:text-primary-dim transition-colors">View All Feed</button>
          </div>

          <div className="relative pl-6 space-y-10">
            <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-outline-variant/20"></div>
            {activities.map((activity, i) => (
              <div key={i} className="relative">
                <div className={cn(
                  "absolute -left-[24px] top-1 w-4 h-4 rounded-full border-[3px] border-white ring-1",
                  activity.status === 'answered' && "bg-primary-container ring-primary-container",
                  activity.status === 'requested' && "bg-tertiary-container ring-tertiary-container",
                  activity.status === 'confirmed' && "bg-slate-200 ring-slate-200",
                  activity.status === 'missed' && "bg-error-container/40 ring-error-container/40",
                )}></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-on-surface">{activity.title}</h4>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded uppercase font-bold",
                        activity.status === 'answered' && "bg-secondary-container text-on-secondary-container",
                        activity.status === 'requested' && "bg-primary-container text-on-primary-container",
                        activity.status === 'confirmed' && "bg-surface-container-highest text-on-surface-variant",
                        activity.status === 'missed' && "bg-error/10 text-error",
                      )}>{activity.status}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{activity.detail}</p>
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-medium whitespace-nowrap">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
