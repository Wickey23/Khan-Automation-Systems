import React from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  Shield,
  Building2,
  TrendingUp,
  ExternalLink,
  Target,
  Zap,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminLeads: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Global Control Plane</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Global Lead Pipeline</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Conversion Rate</span>
            <span className="text-lg font-black text-emerald-400">24.8%</span>
          </div>
          <button className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
            <TrendingUp size={18} />
            Pipeline Analytics
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="h-16 bg-white border-b border-slate-200 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by Lead ID, Org, or Name..." 
              className="w-96 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button className="px-4 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-primary">All Leads</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">High Value</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Stale</button>
          </div>
        </div>
        <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all">
          <Filter size={20} />
        </button>
      </div>

      {/* Lead List */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-6 py-4">Lead / Organization</th>
                <th className="px-6 py-4">Interest / Service</th>
                <th className="px-6 py-4">Score / Urgency</th>
                <th className="px-6 py-4">Est. Value</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { id: 'lead_882', name: 'Robert Fox', org: 'Acme Dental', interest: 'Dental Implants', score: 98, urgency: 'High', value: '$4,500', status: 'Qualified', color: 'bg-emerald-100 text-emerald-600' },
                { id: 'lead_881', name: 'Jane Cooper', org: 'Global RE', interest: 'Luxury Listing', score: 85, urgency: 'Medium', value: '$12,000', status: 'Contacted', color: 'bg-blue-100 text-blue-600' },
                { id: 'lead_880', name: 'Cody Fisher', org: 'Tech Sol', interest: 'Enterprise SaaS', score: 42, urgency: 'Low', value: '$2,400', status: 'New', color: 'bg-slate-100 text-slate-600' },
                { id: 'lead_879', name: 'Esther Howard', org: 'Acme Dental', interest: 'Teeth Whitening', score: 92, urgency: 'High', value: '$800', status: 'Qualified', color: 'bg-emerald-100 text-emerald-600' },
                { id: 'lead_878', name: 'Cameron Williamson', org: 'Health First', interest: 'Annual Checkup', score: 78, urgency: 'Medium', value: '$350', status: 'Contacted', color: 'bg-blue-100 text-blue-600' },
                { id: 'lead_877', name: 'Brooklyn Simmons', org: 'Quick Fix', interest: 'Brake Repair', score: 65, urgency: 'Low', value: '$600', status: 'New', color: 'bg-slate-100 text-slate-600' },
              ].map((lead, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                        {lead.name[0]}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{lead.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Building2 size={10} className="text-slate-400" />
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{lead.org}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <Target size={12} className="text-slate-400" />
                      <span className="text-xs font-medium text-slate-700">{lead.interest}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <Zap size={10} className={cn(lead.score > 80 ? "text-amber-500" : "text-slate-300")} />
                        <span className="text-xs font-bold text-slate-900">{lead.score}</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{lead.urgency}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                      <DollarSign size={10} />
                      {lead.value}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider", lead.color)}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
