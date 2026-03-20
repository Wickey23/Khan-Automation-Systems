import React from 'react';
import { 
  UserPlus, 
  TrendingUp, 
  Target, 
  Zap, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight,
  ArrowUpRight,
  Mail,
  Phone
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const metrics = [
  { label: 'Total Leads', value: '482', trend: '+18%', icon: UserPlus, color: 'primary' },
  { label: 'Conversion Rate', value: '12.4%', trend: '+2.1%', icon: Target, color: 'secondary' },
  { label: 'Active Pipeline', value: '$42.5k', trend: 'Healthy', icon: TrendingUp, color: 'tertiary' },
  { label: 'Avg. Response', value: '45s', trend: 'AI Active', icon: Zap, color: 'primary' },
];

const leads = [
  { id: 1, name: 'Alice Cooper', source: 'Google Search', status: 'new', value: '$1,200', time: '12m ago' },
  { id: 2, name: 'Bob Marley', source: 'Facebook Ad', status: 'contacted', value: '$850', time: '1h ago' },
  { id: 3, name: 'Charlie Sheen', source: 'Referral', status: 'qualified', value: '$3,400', time: '3h ago' },
  { id: 4, name: 'Diana Ross', source: 'Direct', status: 'lost', value: '$0', time: 'Yesterday' },
  { id: 5, name: 'Edward Norton', source: 'Google Search', status: 'new', value: '$2,100', time: 'Yesterday' },
];

export default function LeadsPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Lead Pipeline</h1>
          <p className="text-on-surface-variant text-sm">Track and manage potential customers through the sales funnel.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-surface-container-lowest text-on-surface px-4 py-2 rounded-xl text-sm font-bold border border-outline-variant/20 hover:bg-surface-container-low transition-all">
            Export Leads
          </button>
          <button className="bg-primary text-on-primary px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            Add New Lead
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface-container-lowest p-5 rounded-xl card-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={cn(
                "p-2.5 rounded-xl",
                metric.color === 'primary' && "bg-primary-container/30 text-primary",
                metric.color === 'secondary' && "bg-secondary-container/30 text-secondary",
                metric.color === 'tertiary' && "bg-tertiary-container/40 text-tertiary",
              )}>
                <metric.icon size={20} />
              </div>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                metric.trend.startsWith('+') ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-highest text-on-surface-variant"
              )}>{metric.trend}</span>
            </div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{metric.label}</p>
            <h3 className="text-2xl font-bold mt-1">{metric.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
          <div className="p-6 border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-on-surface">Active Leads</h2>
              <div className="flex bg-surface-container-low p-1 rounded-lg">
                {['All', 'New', 'Contacted'].map((f) => (
                  <button key={f} className={cn(
                    "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                    f === 'All' ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                  )}>{f}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
                <input 
                  type="text" 
                  placeholder="Search leads..."
                  className="bg-surface-container-low border-none rounded-lg pl-9 pr-4 py-1.5 text-xs w-40 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
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
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Name</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Source</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Est. Value</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Added</th>
                  <th className="py-4 px-6 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-surface-container-low/30 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="text-sm font-bold text-on-surface">{lead.name}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs text-on-surface-variant font-medium">{lead.source}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                        lead.status === 'new' && "bg-primary-container text-on-primary-container",
                        lead.status === 'contacted' && "bg-secondary-container text-on-secondary-container",
                        lead.status === 'qualified' && "bg-tertiary-container text-on-tertiary-container",
                        lead.status === 'lost' && "bg-error/10 text-error",
                      )}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs text-on-surface font-bold">{lead.value}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-[11px] text-on-surface-variant font-medium">{lead.time}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="p-1 text-on-surface-variant hover:text-on-surface transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-outline-variant/10 flex justify-center">
            <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View All Leads <ChevronRight size={14} />
            </button>
          </div>
        </section>

        <section className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">Pipeline Velocity</h3>
              <ArrowUpRight className="text-secondary" size={18} />
            </div>
            <div className="space-y-6">
              <div className="relative h-32 flex items-end justify-between px-2">
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="w-6 bg-primary/10 rounded-t-sm relative group">
                    <div className="absolute bottom-0 left-0 w-full bg-primary rounded-t-sm transition-all duration-500 group-hover:bg-primary-dim" style={{ height: `${h}%` }}></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
              <div className="pt-4 border-t border-outline-variant/10 flex justify-between items-center">
                <div className="text-xs font-bold text-on-surface">Weekly Growth</div>
                <div className="text-xs font-bold text-secondary">+24.5%</div>
              </div>
            </div>
          </div>

          <div className="bg-primary p-6 rounded-2xl text-on-primary shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap size={80} />
            </div>
            <h3 className="text-lg font-bold mb-2 relative z-10">AI Outreach Active</h3>
            <p className="text-xs text-on-primary/80 mb-6 leading-relaxed relative z-10">Your AI agent is currently following up with 12 new leads from the last 24 hours.</p>
            <div className="flex gap-2 relative z-10">
              <button className="bg-white text-primary px-4 py-2 rounded-lg text-[11px] font-bold hover:bg-white/90 transition-colors">View Sequences</button>
              <button className="bg-white/10 text-white px-4 py-2 rounded-lg text-[11px] font-bold hover:bg-white/20 transition-colors">Pause AI</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
