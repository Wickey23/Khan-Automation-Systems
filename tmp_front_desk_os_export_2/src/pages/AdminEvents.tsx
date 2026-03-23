import React from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Download, 
  Terminal, 
  Shield, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  ChevronRight,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminEvents: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-20 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <Activity size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Shield className="text-primary" size={14} />
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Admin Audit Log</span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">System Events</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all flex items-center gap-2">
            <Download size={18} />
            Export Log
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
              placeholder="Filter by Org ID, User, or Event Type..." 
              className="w-96 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button className="px-4 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-primary">All Events</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Errors</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Security</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Billing</button>
          </div>
        </div>
        <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all">
          <Filter size={20} />
        </button>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-8 py-4">Event</th>
                <th className="px-8 py-4">Organization</th>
                <th className="px-8 py-4">User / Actor</th>
                <th className="px-8 py-4">Timestamp</th>
                <th className="px-8 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { type: 'Security', title: 'Unauthorized Login Attempt', org: 'Acme Dental', user: 'Unknown (IP: 192.168.1.1)', time: '2 mins ago', icon: Shield, color: 'text-red-600', bg: 'bg-red-50' },
                { type: 'Billing', title: 'Subscription Upgraded', org: 'Global Real Estate', user: 'admin@globalre.io', time: '1 hour ago', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { type: 'System', title: 'Database Migration Started', org: 'System', user: 'Auto-Provisioner', time: '3 hours ago', icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
                { type: 'Error', title: 'AI Inference Timeout', org: 'Tech Solutions', user: 'System', time: '5 hours ago', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
                { type: 'Info', title: 'New Org Provisioned', org: 'Legacy Corp', user: 'SAMEERK0723@gmail.com', time: 'Yesterday', icon: Info, color: 'text-slate-600', bg: 'bg-slate-50' },
              ].map((event, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", event.bg, event.color)}>
                        <event.icon size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{event.title}</h4>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{event.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-slate-700">{event.org}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm text-slate-600 font-medium">{event.user}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <Clock size={14} />
                      {event.time}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                      <ChevronRight size={18} />
                    </button>
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
