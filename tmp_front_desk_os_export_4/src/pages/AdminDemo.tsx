import React from 'react';
import { 
  Shield, 
  Play, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  ExternalLink, 
  Clock, 
  Trash2, 
  Copy,
  Zap,
  RefreshCw,
  Users,
  Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminDemo: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Global Control Plane</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Demo Environments</h1>
        </div>
        <button className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
          <Plus size={18} />
          Provision Demo Org
        </button>
      </header>

      {/* Toolbar */}
      <div className="h-16 bg-white border-b border-slate-200 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search demo accounts..." 
              className="w-96 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary outline-none transition-all"
            />
          </div>
        </div>
        <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all">
          <Filter size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-6 py-4">Demo Environment</th>
                <th className="px-6 py-4">Provisioned For</th>
                <th className="px-6 py-4">Users / Calls</th>
                <th className="px-6 py-4">Expires In</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { id: 'demo_123', name: 'Dental Clinic', type: 'Medical', users: 2, calls: 12, expires: '2h 14m', status: 'Active', color: 'bg-blue-500' },
                { id: 'demo_456', name: 'Real Estate', type: 'Property', users: 1, calls: 8, expires: '5h 45m', status: 'Active', color: 'bg-emerald-500' },
                { id: 'demo_789', name: 'Law Firm', type: 'Legal', users: 0, calls: 4, expires: '0m', status: 'Expired', color: 'bg-slate-400' },
                { id: 'demo_012', name: 'Auto Repair', type: 'Service', users: 3, calls: 15, expires: '1h 05m', status: 'Active', color: 'bg-purple-500' },
                { id: 'demo_345', name: 'Spa & Wellness', type: 'Beauty', users: 1, calls: 5, expires: '4h 20m', status: 'Active', color: 'bg-pink-500' },
              ].map((demo, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-sm", demo.color)}>
                        <Zap size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{demo.name}</h4>
                        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">{demo.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs font-medium text-slate-600">{demo.type}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Users size={10} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">{demo.users}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone size={10} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">{demo.calls}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={12} />
                      {demo.expires}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                      demo.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
                    )}>
                      {demo.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                        <ExternalLink size={16} />
                      </button>
                      <button className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                        <RefreshCw size={16} />
                      </button>
                      <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                        <Trash2 size={16} />
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
