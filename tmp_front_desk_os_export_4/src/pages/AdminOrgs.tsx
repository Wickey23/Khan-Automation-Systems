import React from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight, 
  Shield, 
  Activity, 
  Users,
  ExternalLink,
  Globe,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const AdminOrgs: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-20 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Admin Control Plane</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Organizations</h1>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
          <Plus size={20} />
          Provision New Org
        </button>
      </header>

      {/* Toolbar */}
      <div className="h-16 bg-white border-b border-slate-200 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by ID, Name, or Domain..." 
              className="w-96 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button className="px-4 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-primary">All Orgs</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Active</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Trialing</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Suspended</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Org List */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">ID / Domain</th>
                <th className="px-6 py-4">Plan / Billing</th>
                <th className="px-6 py-4">Usage (MTD)</th>
                <th className="px-6 py-4">Last Event</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { id: 'org_123', name: 'Acme Dental', domain: 'acmedental.com', plan: 'Enterprise', billing: 'Monthly', usage: '4,284 mins', lastEvent: '2m ago', status: 'Active', color: 'bg-primary/10 text-primary' },
                { id: 'org_456', name: 'Global Real Estate', domain: 'globalre.io', plan: 'Professional', billing: 'Annual', usage: '1,120 mins', lastEvent: '14m ago', status: 'Active', color: 'bg-emerald-100 text-emerald-600' },
                { id: 'org_789', name: 'Tech Solutions', domain: 'techsol.net', plan: 'Starter', billing: 'Monthly', usage: '450 mins', lastEvent: '1h ago', status: 'Trialing', color: 'bg-amber-100 text-amber-600' },
                { id: 'org_012', name: 'Legacy Corp', domain: 'legacy.com', plan: 'Enterprise', billing: 'Monthly', usage: '0 mins', lastEvent: '3d ago', status: 'Suspended', color: 'bg-red-100 text-red-600' },
                { id: 'org_345', name: 'Health First', domain: 'hfirst.org', plan: 'Professional', billing: 'Monthly', usage: '890 mins', lastEvent: '5m ago', status: 'Active', color: 'bg-blue-100 text-blue-600' },
                { id: 'org_678', name: 'Quick Fix Auto', domain: 'qfix.com', plan: 'Starter', billing: 'Monthly', usage: '120 mins', lastEvent: '2h ago', status: 'Active', color: 'bg-slate-100 text-slate-600' },
              ].map((org, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-3">
                    <Link to={`/admin/orgs/${org.id}`} className="flex items-center gap-3">
                      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm", org.color)}>
                        {org.name[0]}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{org.name}</h4>
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-mono text-slate-400">{org.id}</p>
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <Globe size={10} />
                        {org.domain}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div>
                      <span className="text-xs font-bold text-slate-700">{org.plan}</span>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{org.billing}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <Activity size={12} className="text-slate-400" />
                      <span className="text-xs font-medium text-slate-600">{org.usage}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-slate-400" />
                      <span className="text-xs text-slate-500">{org.lastEvent}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                      org.status === 'Active' ? "bg-emerald-100 text-emerald-600" : 
                      org.status === 'Trialing' ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
                    )}>
                      <div className={cn("h-1 w-1 rounded-full", 
                        org.status === 'Active' ? "bg-emerald-500" : 
                        org.status === 'Trialing' ? "bg-amber-500" : "bg-red-500"
                      )}></div>
                      {org.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                        <ExternalLink size={16} />
                      </button>
                      <button className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                        <MoreVertical size={16} />
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
