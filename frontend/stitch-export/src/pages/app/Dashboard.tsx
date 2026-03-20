import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  MessageSquare, 
  Calendar, 
  Zap, 
  ShieldCheck, 
  AlertCircle, 
  CreditCard, 
  Settings, 
  ArrowRight, 
  Plus, 
  Search, 
  Filter, 
  RefreshCcw,
  Activity,
  CheckCircle2,
  Lock,
  Clock,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  MoreHorizontal
} from 'lucide-react';
import { PageShell, SectionShell } from '@/src/components/app/PageShell';
import { PageHeader } from '@/src/components/app/PageHeader';
import { MetricCard } from '@/src/components/app/MetricCard';
import { StatusStrip } from '@/src/components/app/StatusStrip';
import { NeedsAttention } from '@/src/components/app/NeedsAttention';
import { ActivityTimeline } from '@/src/components/app/ActivityTimeline';
import { StateCard } from '@/src/components/app/StateCard';
import { cn } from '@/src/lib/utils';

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);

  // Simulate initial data loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Workspace State
  const workspace = {
    name: "Apex Climate Solutions",
    progress: 85,
    isLive: true,
    isProvenLive: false,
    message: "Workspace is live. Complete activation to unlock advanced AI voice training.",
  };

  // Metrics
  const metrics = [
    { title: 'Total Calls', value: 142, icon: PhoneCall, trend: { value: 12, isUp: true }, href: '/app/calls' },
    { title: 'SMS Messages', value: 89, icon: MessageSquare, trend: { value: 5, isUp: true }, href: '/app/messages' },
    { title: 'Appointments', value: 24, icon: Calendar, trend: { value: 2, isUp: false }, href: '/app/appointments' },
    { title: 'Activation', value: '85%', icon: Zap, href: '/app/activation' },
  ];

  // Attention Items
  const attentionItems = [
    {
      id: '1',
      title: 'Billing setup required',
      description: 'Your trial ends in 3 days. Activate your subscription to prevent service interruption.',
      priority: 'high' as const,
      icon: CreditCard,
      ctaText: 'Activate Billing',
      ctaHref: '/app/billing',
      type: 'blocked' as const,
    },
    {
      id: '2',
      title: 'Unconfirmed appointment',
      description: 'A new booking for Mike Rossi (HVAC Repair) needs manual confirmation.',
      priority: 'medium' as const,
      icon: Calendar,
      ctaText: 'Review Booking',
      ctaHref: '/app/appointments',
      type: 'review' as const,
    },
    {
      id: '3',
      title: 'AI Voice Training',
      description: 'Upload your pricing sheet to improve AI accuracy for cost estimates.',
      priority: 'low' as const,
      icon: Settings,
      ctaText: 'Configure AI',
      ctaHref: '/app/settings',
      type: 'setup' as const,
    }
  ];

  // Activity
  const activityItems = [
    {
      id: 'a1',
      type: 'call' as const,
      title: 'Missed Call Answered by AI',
      description: 'Caller Mike Rossi (555-0124) requested HVAC repair. AI captured intent and offered booking.',
      timestamp: '12 mins ago',
      status: 'answered',
    },
    {
      id: 'a2',
      type: 'sms' as const,
      title: 'SMS Follow-up Sent',
      description: 'Automated confirmation sent to Sarah Jenkins for tomorrow\'s 10:00 AM appointment.',
      timestamp: '45 mins ago',
      status: 'sent',
    },
    {
      id: 'a3',
      type: 'booking' as const,
      title: 'New Appointment Booked',
      description: 'Emergency Electrical Repair booked for Titan Towing site. Technician assigned: Alex.',
      timestamp: '2 hours ago',
      status: 'confirmed',
    },
    {
      id: 'a4',
      type: 'system' as const,
      title: 'Workspace Live',
      description: 'Front Desk OS is now actively monitoring your primary business line.',
      timestamp: 'Yesterday',
      status: 'live',
      icon: ShieldCheck,
    }
  ];

  if (isLoading) {
    return (
      <PageShell className="p-8 space-y-8">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-surface-container-low rounded-xl w-1/4" />
          <div className="h-16 bg-surface-container-low rounded-2xl w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-surface-container-low rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <div className="h-64 bg-surface-container-low rounded-2xl" />
              <div className="h-96 bg-surface-container-low rounded-2xl" />
            </div>
            <div className="lg:col-span-4 space-y-8">
              <div className="h-48 bg-surface-container-low rounded-2xl" />
              <div className="h-48 bg-surface-container-low rounded-2xl" />
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="p-8 space-y-8">
      <PageHeader 
        title="Dashboard" 
        description={`Welcome back, ${workspace.name}.`}
        actions={
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg font-bold text-sm hover:bg-surface-container-highest transition-all">
              <RefreshCcw size={16} />
              Sync
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-bold text-sm shadow-lg hover:shadow-primary/20 active:scale-95 transition-all">
              <Plus size={18} />
              New Action
            </button>
          </div>
        }
      />

      {/* Workspace Status Strip */}
      <StatusStrip 
        progress={workspace.progress}
        isLive={workspace.isLive}
        isProvenLive={workspace.isProvenLive}
        message={workspace.message}
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.title}>
            <MetricCard 
              title={metric.title} 
              value={metric.value}
              icon={metric.icon}
              trend={metric.trend}
              href={metric.href}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Attention & Activity */}
        <div className="lg:col-span-8 space-y-8">
          <SectionShell 
            title="Needs attention" 
            description="Prioritized tasks requiring your immediate action."
          >
            <NeedsAttention items={attentionItems} />
          </SectionShell>

          <SectionShell 
            title="Recent activity" 
            description="Real-time log of calls, messages, and system events."
          >
            <ActivityTimeline items={activityItems} />
          </SectionShell>
        </div>

        {/* Right Column: Insights & Gated Features */}
        <div className="lg:col-span-4 space-y-8">
          <SectionShell title="Operational Insights">
            <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-outline uppercase tracking-widest">7-Day Trend</p>
                    <h4 className="text-sm font-bold text-on-surface">Call Volume</h4>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-emerald-600">+14%</span>
                  <span className="text-[10px] text-outline">vs last week</span>
                </div>
              </div>
              
              {/* Simple 7-day visualization */}
              <div className="flex items-end justify-between h-24 gap-1 px-2">
                {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-full rounded-t-sm transition-all hover:opacity-80 group relative",
                      i === 6 ? "bg-primary" : "bg-primary/20"
                    )} 
                    style={{ height: `${h}%` }} 
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-on-surface text-surface text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {h} calls
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between text-[10px] font-bold text-outline uppercase tracking-widest px-1">
                <span>Mon</span>
                <span>Sun</span>
              </div>

              <div className="pt-4 border-t border-outline-variant/10">
                <button className="w-full flex items-center justify-between text-xs font-bold text-primary hover:underline group">
                  View Full Analytics
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </SectionShell>

          <SectionShell title="Advanced Features">
            <StateCard 
              type="locked"
              title="AI Voice Training"
              description="Upload your call recordings to train the AI on your specific business tone and technical terminology."
              ctaText="Upgrade to Pro"
              ctaHref="/app/billing"
              className="p-8"
            />
          </SectionShell>

          <SectionShell title="Quick Settings">
            <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 divide-y divide-outline-variant/10">
              <button className="w-full p-4 flex items-center justify-between hover:bg-surface-container-high transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface-container-highest rounded-lg flex items-center justify-center text-on-surface-variant">
                    <PhoneCall size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">Call Routing</p>
                    <p className="text-[10px] text-outline">Manage how calls reach AI</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-outline-variant" />
              </button>
              <button className="w-full p-4 flex items-center justify-between hover:bg-surface-container-high transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface-container-highest rounded-lg flex items-center justify-center text-on-surface-variant">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">SMS Templates</p>
                    <p className="text-[10px] text-outline">Edit automated responses</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-outline-variant" />
              </button>
            </div>
          </SectionShell>
        </div>
      </div>
    </PageShell>
  );
}
