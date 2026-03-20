import React from 'react';
import { 
  Activity, 
  Zap, 
  AlertCircle, 
  Clock, 
  Database, 
  Globe, 
  Terminal, 
  RefreshCw, 
  CheckCircle2, 
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Cloud,
  MessageSquare,
  Sparkles,
  ShoppingCart,
  Network
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const metrics = [
  { label: 'Webhook Success Rate', value: '99.8%', trend: '+0.2% vs avg', icon: RefreshCw, color: 'secondary' },
  { label: 'Active Queues', value: '12', trend: 'Stable processing load', icon: Database, color: 'primary' },
  { label: 'Failed Jobs', value: '3', trend: 'Immediate action required', icon: AlertCircle, color: 'error' },
  { label: 'API Latency', value: '142ms', trend: 'P99: 185ms', icon: Zap, color: 'tertiary' },
];

const operations = [
  { id: 'ST-0912', tenant: 'Starlight Corp', event: 'AI Processing', status: 'processing', time: '14:22:45', icon: Network },
  { id: 'NX-4411', tenant: 'NexGen Media', event: 'Webhook Received', status: 'failed', time: '14:18:12', icon: Cloud },
  { id: 'SR-2290', tenant: 'Swift Retail', event: 'Job Triggered', status: 'queued', time: '14:15:33', icon: ShoppingCart },
  { id: 'HL-1104', tenant: 'HealthLink', event: 'SMS Sent', status: 'completed', time: '14:12:01', icon: MessageSquare },
  { id: 'DL-7781', tenant: 'DeepLogistics', event: 'AI Processing', status: 'stuck', time: '14:05:10', icon: Sparkles },
];

const clusters = [
  { name: 'US-East-1', status: 'active', load: 65, nodes: 8, color: 'primary' },
  { name: 'EU-Central-1', status: 'active', load: 42, nodes: 6, color: 'primary' },
  { name: 'AP-South-1', status: 'degraded', load: 88, nodes: 4, color: 'warning' },
];

export default function InfrastructurePage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">Infrastructure Health</h1>
          <p className="text-on-surface-variant text-sm mt-1">Real-time monitoring of tenant-wide operations and system-level performance metrics.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant bg-surface-container-high px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live System Sync Active
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.label} className={cn(
            "bg-surface-container-lowest p-6 rounded-xl border border-transparent shadow-sm flex flex-col justify-between",
            metric.color === 'error' && "border-l-4 border-error"
          )}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">{metric.label}</span>
              <div className={cn(
                "p-2 rounded-lg",
                metric.color === 'primary' && "bg-primary-container/30 text-primary",
                metric.color === 'secondary' && "bg-secondary-container/30 text-secondary",
                metric.color === 'error' && "bg-error-container/20 text-error",
                metric.color === 'tertiary' && "bg-tertiary-container/40 text-tertiary",
              )}>
                <metric.icon size={18} />
              </div>
            </div>
            <div>
              <div className={cn("text-3xl font-bold mb-1", metric.color === 'error' ? "text-error" : "text-on-surface")}>{metric.value}</div>
              <div className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                metric.color === 'error' ? "text-error" : metric.color === 'secondary' ? "text-emerald-600" : "text-on-surface-variant"
              )}>
                {metric.color === 'secondary' && <Activity size={12} />}
                {metric.color === 'error' && <AlertCircle size={12} />}
                <span>{metric.trend}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
        <div className="px-8 pt-8 pb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-on-surface tracking-tight">Operational Ledger</h2>
            <p className="text-xs text-on-surface-variant">Real-time trace of system events across all active tenants.</p>
          </div>
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
            {['All', 'Failed', 'Retrying', 'Stuck', 'Terminal'].map((tab) => (
              <button key={tab} className={cn(
                "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                tab === 'All' ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:bg-white/50"
              )}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/30 border-b border-outline-variant/10">
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Time</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Tenant/Client</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Event Type</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {operations.map((op) => (
                <tr key={op.id} className={cn(
                  "hover:bg-surface-container-low transition-colors group",
                  op.status === 'failed' && "bg-error/5",
                  op.status === 'stuck' && "bg-amber-50/30"
                )}>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-on-surface">{op.time}</span>
                      <span className="text-[10px] text-on-surface-variant">Today</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-secondary-container">
                        <op.icon size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-on-surface">{op.tenant}</span>
                        <span className="text-[10px] text-on-surface-variant">ID: {op.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        op.status === 'processing' && "bg-blue-400",
                        op.status === 'failed' && "bg-slate-400",
                        op.status === 'queued' && "bg-purple-400",
                        op.status === 'completed' && "bg-emerald-400",
                        op.status === 'stuck' && "bg-amber-400",
                      )}></div>
                      <span className="text-sm text-on-surface">{op.event}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      op.status === 'processing' && "bg-secondary-container text-on-secondary-container",
                      op.status === 'failed' && "bg-error-container text-on-error-container",
                      op.status === 'queued' && "bg-surface-container-high text-on-surface-variant",
                      op.status === 'completed' && "bg-emerald-100 text-emerald-800",
                      op.status === 'stuck' && "bg-amber-100 text-amber-800",
                    )}>
                      {op.status === 'processing' && <RefreshCw size={12} className="animate-spin" />}
                      {op.status === 'failed' && <AlertCircle size={12} />}
                      {op.status === 'queued' && <Clock size={12} />}
                      {op.status === 'completed' && <CheckCircle2 size={12} />}
                      {op.status === 'stuck' && <PauseCircle size={12} />}
                      {op.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className={cn(
                      "flex items-center gap-3 transition-opacity",
                      op.status === 'failed' || op.status === 'stuck' ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <button className="text-xs font-semibold text-primary hover:text-primary-dim">View Log</button>
                      {op.status === 'failed' ? (
                        <button className="px-3 py-1 bg-primary text-white text-[10px] font-bold rounded hover:bg-primary-dim transition-colors">Retry Now</button>
                      ) : op.status === 'stuck' ? (
                        <button className="text-xs font-semibold text-on-surface-variant hover:text-on-surface">Kill Job</button>
                      ) : (
                        <button className="text-xs font-semibold text-on-surface-variant hover:text-on-surface">Retry</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-4 bg-surface-container-low/30 border-t border-outline-variant/10 flex items-center justify-between">
          <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">Showing 5 of 1,248 active operations</span>
          <div className="flex items-center gap-2">
            <button className="p-1 rounded hover:bg-surface-container-highest transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-semibold text-on-surface">1</span>
            <button className="p-1 rounded hover:bg-surface-container-highest transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="xl:w-2/3 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
          <h3 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
            <Activity className="text-primary" size={20} />
            Cluster Distribution
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {clusters.map((cluster) => (
              <div key={cluster.name} className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  <span>{cluster.name}</span>
                  <span className={cn(
                    cluster.status === 'active' ? "text-emerald-500" : "text-amber-500"
                  )}>{cluster.status}</span>
                </div>
                <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                  <div className={cn(
                    "h-full rounded-full transition-all duration-500",
                    cluster.status === 'active' ? "bg-primary" : "bg-amber-400"
                  )} style={{ width: `${cluster.load}%` }}></div>
                </div>
                <p className="text-[10px] text-on-surface-variant">{cluster.load}% Load • {cluster.nodes} Nodes</p>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:w-1/3 bg-primary-dim text-white p-8 rounded-xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Terminal size={80} />
          </div>
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-2">Diagnostic Shell</h3>
            <p className="text-xs text-white/70 mb-6 leading-relaxed">Execute low-level system checks or flush persistent caching layers across the cluster.</p>
            <div className="space-y-3 mb-8">
              <button className="w-full flex items-center justify-between px-4 py-2.5 rounded bg-white/10 hover:bg-white/20 transition-colors border border-white/10 group-hover:border-white/30">
                <span className="text-xs font-medium">Verify API Gateway Integrity</span>
                <ArrowRight size={14} />
              </button>
              <button className="w-full flex items-center justify-between px-4 py-2.5 rounded bg-white/10 hover:bg-white/20 transition-colors border border-white/10 group-hover:border-white/30">
                <span className="text-xs font-medium">Re-sync Elastic Shards</span>
                <ArrowRight size={14} />
              </button>
            </div>
            <button className="px-6 py-2.5 bg-white text-primary-dim rounded-lg text-sm font-bold shadow-xl hover:scale-105 transition-transform active:scale-100">
              Launch Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
