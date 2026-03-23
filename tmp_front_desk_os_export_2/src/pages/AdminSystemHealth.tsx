import React from 'react';
import { 
  Activity, 
  Shield, 
  Cpu, 
  Database, 
  Globe, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Server,
  Network
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminSystemHealth: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-20 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Activity size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Shield className="text-primary" size={14} />
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Admin Infrastructure</span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">System Health</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold uppercase tracking-wider">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            All Systems Operational
          </div>
          <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all">
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Service Grid */}
          <div className="grid grid-cols-3 gap-8">
            {[
              { name: 'Core API Gateway', status: 'Operational', uptime: '99.99%', latency: '42ms', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { name: 'Real-time Voice Engine', status: 'Operational', uptime: '99.95%', latency: '128ms', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { name: 'Firestore Database', status: 'Operational', uptime: '100%', latency: '12ms', icon: Database, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { name: 'AI Inference Cluster', status: 'Degraded', uptime: '98.2%', latency: '1.4s', icon: Cpu, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { name: 'Global CDN', status: 'Operational', uptime: '99.99%', latency: '8ms', icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { name: 'Auth Service', status: 'Operational', uptime: '100%', latency: '24ms', icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            ].map((service, i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", service.bg, service.color)}>
                    <service.icon size={24} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Uptime</p>
                    <p className="text-sm font-bold text-slate-900">{service.uptime}</p>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{service.name}</h3>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <span className={cn("text-xs font-bold uppercase tracking-wider", service.color)}>{service.status}</span>
                  <span className="text-xs font-medium text-slate-500">{service.latency}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-2 gap-8">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Server size={20} className="text-primary" />
                  Resource Utilization
                </h3>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last 24 Hours</span>
              </div>
              <div className="p-8 space-y-8">
                {[
                  { label: 'CPU Usage', value: '42%', color: 'bg-primary' },
                  { label: 'Memory Usage', value: '68%', color: 'bg-purple-500' },
                  { label: 'Network I/O', value: '24%', color: 'bg-emerald-500' },
                  { label: 'Disk I/O', value: '12%', color: 'bg-amber-500' },
                ].map((metric, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="text-slate-600">{metric.label}</span>
                      <span className="text-slate-900">{metric.value}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-1000", metric.color)} style={{ width: metric.value }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-500" />
                  Recent Incidents
                </h3>
                <button className="text-sm font-bold text-primary hover:underline">View History</button>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { title: 'AI Inference Latency Spike', time: '2 hours ago', status: 'Investigating', severity: 'Medium' },
                  { title: 'Database Maintenance', time: 'Yesterday', status: 'Resolved', severity: 'Low' },
                  { title: 'Voice Gateway Connectivity', time: 'Mar 14', status: 'Resolved', severity: 'High' },
                ].map((incident, i) => (
                  <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center",
                        incident.severity === 'High' ? "bg-red-100 text-red-600" : 
                        incident.severity === 'Medium' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                      )}>
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{incident.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Clock size={12} />
                          {incident.time}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      incident.status === 'Resolved' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {incident.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
