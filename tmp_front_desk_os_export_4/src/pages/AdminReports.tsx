import React from 'react';
import { 
  Shield, 
  Activity, 
  RefreshCw, 
  FileText, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  Settings, 
  Search,
  Filter,
  ArrowRight,
  Database,
  Mail,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminReports: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Global Control Plane</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Reporting Engine & Diagnostics</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-400">Engine Online</span>
          </div>
          <button className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
            <Play size={18} />
            Run Global Batch
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* System Status Grid */}
          <div className="grid grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Activity size={20} />
                </div>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Healthy</span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last Global Batch</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">Completed 14m ago</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <CheckCircle2 size={12} className="text-emerald-500" />
                1,242 reports processed successfully
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Attention</span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quarantine Queue</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">12 Failures Detected</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-600">
                <RefreshCw size={12} className="animate-spin-slow" />
                Retrying 4 validation errors...
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Database size={20} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Standby</span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Scheduled Run</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">Today, 11:00 PM</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <Clock size={12} />
                Daily aggregation: 42.4GB data
              </div>
            </div>
          </div>

          {/* Report Definitions */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Available Report Definitions</h3>
              <button className="text-xs font-bold text-primary hover:underline">Manage Definitions</button>
            </div>
            <div className="grid grid-cols-4 gap-6">
              {[
                { title: 'Org Usage Audit', desc: 'Detailed breakdown of minutes and tokens per organization.', icon: FileText },
                { title: 'AI Performance', desc: 'Latency and accuracy metrics across all inference nodes.', icon: Activity },
                { title: 'Lead Conversion', desc: 'Global lead-to-booking conversion rates and pipeline value.', icon: Users },
                { title: 'System Incidents', desc: 'Audit log of all system warnings and critical failures.', icon: Shield },
              ].map((report, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-primary transition-all cursor-pointer group">
                  <div className="h-12 w-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                    <report.icon size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">{report.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{report.desc}</p>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">v2.4.0</span>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-primary transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recipients & Distribution */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Report Distribution & Recipients</h3>
                <p className="text-xs text-slate-500 mt-1">Internal stakeholders receiving automated diagnostic reports.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search recipients..." 
                    className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs focus:border-primary outline-none transition-all"
                  />
                </div>
                <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all">
                  <Filter size={20} />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="px-8 py-4">Recipient</th>
                    <th className="px-8 py-4">Assigned Reports</th>
                    <th className="px-8 py-4">Frequency</th>
                    <th className="px-8 py-4">Last Sent</th>
                    <th className="px-8 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { name: 'Sameer Kumar', email: 'sameerk0723@gmail.com', reports: ['Org Usage', 'System Incidents'], freq: 'Daily', last: '14m ago', status: 'Active' },
                    { name: 'Ops Team', email: 'ops@frontdesk.ai', reports: ['AI Performance', 'Lead Conversion'], freq: 'Real-time', last: '2m ago', status: 'Active' },
                    { name: 'Engineering', email: 'eng-alerts@frontdesk.ai', reports: ['System Incidents'], freq: 'Critical Only', last: '3 days ago', status: 'Active' },
                    { name: 'Finance Audit', email: 'billing@frontdesk.ai', reports: ['Org Usage Audit'], freq: 'Monthly', last: '16 days ago', status: 'Standby' },
                  ].map((recipient, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                            {recipient.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{recipient.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{recipient.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex flex-wrap gap-1">
                          {recipient.reports.map((r, j) => (
                            <span key={j} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-wider">{r}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-xs font-medium text-slate-600">{recipient.freq}</span>
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-xs text-slate-400 font-medium">{recipient.last}</span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                          recipient.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
                        )}>
                          {recipient.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

