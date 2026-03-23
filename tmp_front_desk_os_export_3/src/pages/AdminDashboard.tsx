import React from 'react';
import { 
  Shield, 
  Activity, 
  Users, 
  Building2, 
  Phone, 
  MessageSquare, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

const data = [
  { name: '00:00', calls: 45, messages: 120 },
  { name: '04:00', calls: 12, messages: 45 },
  { name: '08:00', calls: 180, messages: 450 },
  { name: '12:00', calls: 320, messages: 890 },
  { name: '16:00', calls: 280, messages: 760 },
  { name: '20:00', calls: 150, messages: 340 },
  { name: '23:59', calls: 60, messages: 150 },
];

export const AdminDashboard: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Global Control Plane</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">System Overview</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Status</span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
              All Systems Operational
            </span>
          </div>
          <div className="h-10 w-[1px] bg-slate-800 mx-2"></div>
          <button className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
            <Zap size={18} />
            Global Config
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Total Organizations', value: '1,284', change: '+12%', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active Sessions', value: '8,432', change: '+5.4%', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Global Call Volume', value: '142.5k', change: '+18%', icon: Phone, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'AI Tokens (24h)', value: '84.2M', change: '-2.1%', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', trend: 'down' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
                    <stat.icon size={20} />
                  </div>
                  <div className={cn(
                    "flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
                    stat.trend === 'down' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {stat.trend === 'down' ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                    {stat.change}
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-8">
            {/* Traffic Chart */}
            <div className="col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Global Traffic Flow</h3>
                  <p className="text-xs text-slate-500 font-medium">Real-time call and message volume across all organizations</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Calls</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Messages</span>
                  </div>
                </div>
              </div>
              <div className="p-8 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3caff6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3caff6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="calls" stroke="#3caff6" strokeWidth={3} fillOpacity={1} fill="url(#colorCalls)" />
                    <Area type="monotone" dataKey="messages" stroke="#cbd5e1" strokeWidth={2} fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">Infrastructure Health</h3>
              </div>
              <div className="p-8 flex-1 space-y-6">
                {[
                  { name: 'US-EAST-1 (Primary)', status: 'Healthy', load: '42%', color: 'text-emerald-500' },
                  { name: 'US-WEST-2 (Failover)', status: 'Healthy', load: '12%', color: 'text-emerald-500' },
                  { name: 'EU-CENTRAL-1', status: 'Healthy', load: '28%', color: 'text-emerald-500' },
                  { name: 'AI Inference Cluster', status: 'Degraded', load: '89%', color: 'text-amber-500', sub: 'High Latency' },
                  { name: 'Voice Gateway API', status: 'Healthy', load: '34%', color: 'text-emerald-500' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.name}</p>
                      {item.sub && <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{item.sub}</p>}
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xs font-bold", item.color)}>{item.status}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.load} Load</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-200">
                <button className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all">
                  View Full Status Page
                </button>
              </div>
            </div>
          </div>

          {/* Recent Events Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Global Event Log</h3>
              <button className="text-sm font-bold text-primary hover:underline">View All Events</button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-8 py-4">Event Type</th>
                  <th className="px-8 py-4">Organization</th>
                  <th className="px-8 py-4">Description</th>
                  <th className="px-8 py-4">Timestamp</th>
                  <th className="px-8 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { type: 'Provisioning', org: 'Acme Dental', desc: 'New organization provisioned successfully', time: '2 mins ago', status: 'Success' },
                  { type: 'Billing', org: 'Global RE', desc: 'Subscription upgraded to Enterprise', time: '14 mins ago', status: 'Success' },
                  { type: 'AI Failure', org: 'Tech Sol', desc: 'Inference timeout on call_id: 8429', time: '28 mins ago', status: 'Warning' },
                  { type: 'Security', org: 'System', desc: 'Admin login from new IP: 192.168.1.1', time: '1 hour ago', status: 'Info' },
                ].map((event, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-4">
                      <span className="text-xs font-bold text-slate-900">{event.type}</span>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-xs font-medium text-slate-600">{event.org}</span>
                    </td>
                    <td className="px-8 py-4">
                      <p className="text-xs text-slate-500 truncate max-w-xs">{event.desc}</p>
                    </td>
                    <td className="px-8 py-4 text-xs text-slate-400 font-medium">
                      {event.time}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                        event.status === 'Success' ? "bg-emerald-50 text-emerald-600" :
                        event.status === 'Warning' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {event.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
