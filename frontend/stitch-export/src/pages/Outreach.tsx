import React from 'react';
import { 
  Megaphone, 
  Zap, 
  Target, 
  BarChart3, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const metrics = [
  { label: 'Active Sequences', value: '12', icon: Megaphone, color: 'primary' },
  { label: 'Total Events Sent', value: '4,284', icon: Zap, color: 'secondary' },
  { label: 'Failure Rate', value: '0.8%', icon: AlertCircle, color: 'error' },
  { label: 'Opt-out Rate', value: '1.2%', icon: Target, color: 'tertiary' },
];

const sequences = [
  { id: 1, name: 'New Lead Follow-up', status: 'active', sent: '1,240', conversion: '18.4%', lastActive: '2m ago' },
  { id: 2, name: 'Appointment Reminder', status: 'active', sent: '2,842', conversion: '94.2%', lastActive: 'Just now' },
  { id: 3, name: 'Re-engagement Campaign', status: 'paused', sent: '156', conversion: '4.1%', lastActive: '2 days ago' },
  { id: 4, name: 'Post-Service Feedback', status: 'active', sent: '842', conversion: '22.8%', lastActive: '1h ago' },
];

const auditLogs = [
  { id: 1, event: 'SMS Sent', target: 'John Smith', status: 'success', time: '10:30:45 AM', detail: 'Sequence: New Lead Follow-up • Step 1' },
  { id: 2, event: 'Voice Call', target: 'Sarah Jones', status: 'failed', time: '10:28:12 AM', detail: 'Sequence: Appointment Reminder • Step 2 • Error: User Busy' },
  { id: 3, event: 'SMS Sent', target: 'Mike Doe', status: 'success', time: '10:25:55 AM', detail: 'Sequence: Re-engagement • Step 1' },
  { id: 4, event: 'Email Sent', target: 'Emily Blunt', status: 'success', time: '10:22:30 AM', detail: 'Sequence: Feedback • Step 1' },
];

export default function OutreachPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Outreach Pulse</h1>
          <p className="text-on-surface-variant text-sm">Monitor and manage automated customer outreach sequences.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-surface-container-lowest text-on-surface px-4 py-2 rounded-xl text-sm font-bold border border-outline-variant/20 hover:bg-surface-container-low transition-all">
            View Templates
          </button>
          <button className="bg-primary text-on-primary px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            Create Sequence
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface-container-lowest p-5 rounded-xl card-shadow">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl",
                metric.color === 'primary' && "bg-primary-container/30 text-primary",
                metric.color === 'secondary' && "bg-secondary-container/30 text-secondary",
                metric.color === 'error' && "bg-error-container/20 text-error",
                metric.color === 'tertiary' && "bg-tertiary-container/40 text-tertiary",
              )}>
                <metric.icon size={20} />
              </div>
              <div>
                <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{metric.label}</p>
                <h3 className="text-2xl font-bold">{metric.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-12 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
          <div className="p-6 border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-on-surface">Active Sequences</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
                <input 
                  type="text" 
                  placeholder="Search sequences..."
                  className="bg-surface-container-low border-none rounded-lg pl-9 pr-4 py-1.5 text-xs w-48 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <button className="p-2 bg-surface-container-low text-on-surface-variant rounded-lg hover:bg-surface-container transition-colors">
                <Filter size={16} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/30">
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Sequence Name</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Total Sent</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Conversion</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Last Active</th>
                  <th className="py-4 px-6 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {sequences.map((seq) => (
                  <tr key={seq.id} className="hover:bg-surface-container-low/30 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="text-sm font-bold text-on-surface">{seq.name}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                        seq.status === 'active' ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-highest text-on-surface-variant"
                      )}>
                        {seq.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-on-surface font-medium">{seq.sent}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden max-w-[60px]">
                          <div className="h-full bg-primary rounded-full" style={{ width: seq.conversion }}></div>
                        </div>
                        <span className="text-xs font-bold text-on-surface">{seq.conversion}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-[11px] text-on-surface-variant font-medium">{seq.lastActive}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 text-on-surface-variant hover:text-primary transition-colors">
                          {seq.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button className="p-1.5 text-on-surface-variant hover:text-primary transition-colors">
                          <RotateCcw size={16} />
                        </button>
                        <button className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-12 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
          <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
            <h2 className="text-lg font-bold text-on-surface">Event Lifecycle Audit</h2>
            <button className="text-xs font-bold text-primary hover:underline">Download Audit Log</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/30">
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Event</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Target</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Timestamp</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="text-xs font-bold text-on-surface">{log.event}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs text-on-surface-variant font-medium">{log.target}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5">
                        {log.status === 'success' ? (
                          <CheckCircle2 size={14} className="text-secondary" />
                        ) : (
                          <AlertCircle size={14} className="text-error" />
                        )}
                        <span className={cn(
                          "text-[10px] font-bold uppercase",
                          log.status === 'success' ? "text-secondary" : "text-error"
                        )}>{log.status}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-medium">
                        <Clock size={12} /> {log.time}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-[11px] text-on-surface-variant">{log.detail}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
