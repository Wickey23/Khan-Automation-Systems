import React from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Calendar, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownRight,
  Users,
  Building2,
  Activity,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminReports: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-20 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Platform Analytics</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-0.5">Admin Reporting Suite</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-4 py-2 border border-slate-700">
            <Calendar size={16} className="text-slate-400" />
            <span className="text-xs font-bold text-white">Last 30 Days</span>
          </div>
          <button className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
            <Download size={18} />
            Export Data
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* High Level Metrics */}
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Total Revenue', value: '$124,500', trend: '+12.5%', up: true, icon: TrendingUp },
              { label: 'Active Orgs', value: '482', trend: '+8.2%', up: true, icon: Building2 },
              { label: 'Total Users', value: '12,402', trend: '+15.4%', up: true, icon: Users },
              { label: 'Avg. Latency', value: '142ms', trend: '-4.2%', up: true, icon: Activity },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <stat.icon size={20} />
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                    stat.up ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                  )}>
                    {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {stat.trend}
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-8">
            {/* Usage Chart Placeholder */}
            <div className="col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Platform Growth</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary"></div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-slate-200"></div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Orgs</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-8 flex items-center justify-center bg-slate-50/30">
                <div className="text-center">
                  <BarChart3 size={48} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-sm font-bold text-slate-400">Chart Visualization Placeholder</p>
                </div>
              </div>
            </div>

            {/* Top Orgs */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">Top Organizations</h3>
              </div>
              <div className="flex-1 divide-y divide-slate-100">
                {[
                  { name: 'Acme Dental', revenue: '$12,400', growth: '+5.2%' },
                  { name: 'Global Real Estate', revenue: '$8,200', growth: '+12.4%' },
                  { name: 'Tech Solutions', revenue: '$6,100', growth: '+2.1%' },
                  { name: 'Legacy Corp', revenue: '$4,800', growth: '-1.4%' },
                  { name: 'Future Health', revenue: '$3,200', growth: '+24.5%' },
                ].map((org, i) => (
                  <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{org.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{org.revenue} / mo</p>
                    </div>
                    <div className={cn(
                      "text-[10px] font-bold uppercase",
                      org.growth.startsWith('+') ? "text-emerald-600" : "text-red-600"
                    )}>
                      {org.growth}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                <button className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-primary transition-all">
                  <span>View All Organizations</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-2 gap-8">
            <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">AI Performance</h3>
              <div className="space-y-6">
                {[
                  { label: 'Intent Accuracy', value: '98.4%', target: '95%' },
                  { label: 'Avg. Response Time', value: '1.2s', target: '1.5s' },
                  { label: 'Tool Call Success', value: '99.2%', target: '99%' },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="text-slate-600">{stat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900">{stat.value}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Target: {stat.target}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: stat.value }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Voice Gateway Health</h3>
              <div className="space-y-6">
                {[
                  { label: 'Call Completion', value: '99.8%', target: '99.5%' },
                  { label: 'Audio Quality (MOS)', value: '4.8/5', target: '4.5' },
                  { label: 'Concurrent Streams', value: '1,242', target: '5,000' },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="text-slate-600">{stat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900">{stat.value}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Target: {stat.target}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: i === 2 ? '25%' : stat.value }}></div>
                    </div>
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
