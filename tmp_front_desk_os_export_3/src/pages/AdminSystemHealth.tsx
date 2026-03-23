import React from 'react';
import { 
  Shield, 
  Activity, 
  Server, 
  Database, 
  Globe, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Cpu,
  HardDrive,
  Network
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminSystemHealth: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Global Control Plane</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">System Health & Infrastructure</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-400">All Systems Nominal</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Real-time Monitors */}
          <div className="grid grid-cols-3 gap-8">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Cpu size={20} className="text-primary" />
                  Compute Clusters
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
              </div>
              <div className="p-8 space-y-6">
                {[
                  { name: 'Inference Node A', load: 78, status: 'Healthy' },
                  { name: 'Inference Node B', load: 82, status: 'Healthy' },
                  { name: 'API Gateway Cluster', load: 34, status: 'Healthy' },
                  { name: 'Worker Pool (Async)', load: 12, status: 'Idle' },
                ].map((node, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">{node.name}</span>
                      <span className={cn(node.load > 80 ? "text-amber-500" : "text-emerald-500")}>{node.load}% Load</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", node.load > 80 ? "bg-amber-500" : "bg-primary")} 
                        style={{ width: `${node.load}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Database size={20} className="text-purple-500" />
                  Database Health
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
              </div>
              <div className="p-8 space-y-6">
                {[
                  { name: 'Firestore (Primary)', latency: '42ms', status: 'Healthy' },
                  { name: 'Redis Cache', latency: '2ms', status: 'Healthy' },
                  { name: 'Vector DB', latency: '124ms', status: 'Healthy' },
                  { name: 'Analytics Store', latency: '85ms', status: 'Healthy' },
                ].map((db, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/50">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{db.name}</p>
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{db.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700">{db.latency}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Latency</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Network size={20} className="text-emerald-500" />
                  Network & Edge
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
              </div>
              <div className="p-8 space-y-6">
                {[
                  { name: 'Global CDN', uptime: '99.99%', status: 'Healthy' },
                  { name: 'Voice WebSocket', uptime: '99.95%', status: 'Healthy' },
                  { name: 'SMS Gateway', uptime: '99.98%', status: 'Healthy' },
                  { name: 'Auth Service', uptime: '100%', status: 'Healthy' },
                ].map((net, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{net.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Uptime: {net.uptime}</p>
                    </div>
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* System Logs */}
          <section className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">System Logs (STDOUT)</h3>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Streaming Live</span>
              </div>
            </div>
            <div className="p-8 font-mono text-[11px] leading-relaxed text-slate-400 bg-black/50 h-96 overflow-y-auto space-y-1">
              <p><span className="text-slate-600">[2026-03-16 03:27:46]</span> <span className="text-emerald-500">INFO</span>: Incoming call_id: 9428 routed to inference_node_a</p>
              <p><span className="text-slate-600">[2026-03-16 03:27:48]</span> <span className="text-emerald-500">INFO</span>: AI response generated in 120ms (tokens: 42)</p>
              <p><span className="text-slate-600">[2026-03-16 03:27:52]</span> <span className="text-blue-500">DEBUG</span>: DB query: SELECT * FROM organizations WHERE id = 'org_123'</p>
              <p><span className="text-slate-600">[2026-03-16 03:27:55]</span> <span className="text-emerald-500">INFO</span>: SMS sent to +15551234567 (provider: twilio)</p>
              <p><span className="text-slate-600">[2026-03-16 03:28:01]</span> <span className="text-amber-500">WARN</span>: High latency detected on EU-CENTRAL-1 (145ms)</p>
              <p><span className="text-slate-600">[2026-03-16 03:28:05]</span> <span className="text-emerald-500">INFO</span>: User login: admin@stitch.ai (IP: 192.168.1.1)</p>
              <p><span className="text-slate-600">[2026-03-16 03:28:12]</span> <span className="text-emerald-500">INFO</span>: Call completed: call_id: 9428 (duration: 4m 12s)</p>
              <p><span className="text-slate-600">[2026-03-16 03:28:15]</span> <span className="text-emerald-500">INFO</span>: Background task: sync_billing_data completed</p>
              <p className="animate-pulse text-white">_</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
