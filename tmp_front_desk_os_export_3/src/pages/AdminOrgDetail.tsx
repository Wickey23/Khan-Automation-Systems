import React from 'react';
import { 
  useParams, 
  Link 
} from 'react-router-dom';
import { 
  ChevronLeft, 
  Building2, 
  Globe, 
  Users, 
  Activity, 
  Settings, 
  Shield, 
  Zap, 
  Database, 
  Key,
  ExternalLink,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminOrgDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <Link to="/admin/orgs" className="h-10 w-10 rounded-xl border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-all">
            <ChevronLeft size={24} />
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-primary/20">
              A
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Organization Detail</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID: {id}</span>
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Acme Dental</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all flex items-center gap-2">
            <Settings size={18} />
            Config
          </button>
          <button className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
            <ExternalLink size={18} />
            Impersonate
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="h-14 bg-white border-b border-slate-200 px-12 flex items-center gap-8 shrink-0">
        {['Overview', 'Users', 'Billing', 'System Logs', 'Testing Lab', 'Integrations'].map((tab, i) => (
          <button key={i} className={cn(
            "h-full px-1 text-sm font-bold border-b-2 transition-all",
            i === 0 ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
          )}>
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Readiness Workflow */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-primary" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Readiness Checklist</h3>
              </div>
              <span className="text-xs font-bold text-slate-500">60% Complete</span>
            </div>
            <div className="p-8 grid grid-cols-3 gap-6">
              {[
                { label: 'Organization Provisioned', status: 'completed' },
                { label: 'Domain Verified', status: 'completed' },
                { label: 'Primary Admin Invited', status: 'completed' },
                { label: 'Voice Gateway Configured', status: 'pending' },
                { label: 'AI Model Training', status: 'pending' },
                { label: 'Billing Method Verified', status: 'warning' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/30">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                    step.status === 'completed' ? "bg-emerald-100 text-emerald-600" :
                    step.status === 'warning' ? "bg-amber-100 text-amber-600" : "bg-slate-200 text-slate-400"
                  )}>
                    {step.status === 'completed' ? <CheckCircle2 size={14} /> : 
                     step.status === 'warning' ? <AlertCircle size={14} /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
                  </div>
                  <span className={cn("text-xs font-bold", step.status === 'pending' ? "text-slate-500" : "text-slate-900")}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Total Users', value: '24', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active Calls', value: '3', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Storage Used', value: '1.2 GB', icon: Database, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'API Requests', value: '12.4k', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
                    <stat.icon size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MTD</span>
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-8">
            {/* Org Info */}
            <div className="col-span-2 space-y-8">
              <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">General Information</h3>
                  <button className="text-sm font-bold text-primary hover:underline">Edit Info</button>
                </div>
                <div className="p-8 grid grid-cols-2 gap-x-12 gap-y-8">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Domain</label>
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      acmedental.com
                      <Globe size={14} className="text-slate-400" />
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Created At</label>
                    <p className="text-sm font-bold text-slate-900">Jan 12, 2026</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Primary Contact</label>
                    <p className="text-sm font-bold text-slate-900">Dr. Aris (aris@acmedental.com)</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Region</label>
                    <p className="text-sm font-bold text-slate-900">US-EAST-1</p>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900">API Keys & Access</h3>
                </div>
                <div className="p-8 space-y-4">
                  {[
                    { label: 'Production Key', key: 'pk_live_••••••••••••••••', lastUsed: '2 mins ago' },
                    { label: 'Secret Key', key: 'sk_live_••••••••••••••••', lastUsed: '1 hour ago' },
                  ].map((key, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                          <Key size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{key.label}</p>
                          <p className="text-xs font-mono text-slate-500 mt-0.5">{key.key}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Used</p>
                        <p className="text-xs font-medium text-slate-600">{key.lastUsed}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-8">
              <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-200 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">System Health</h3>
                </div>
                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Database</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                      <CheckCircle2 size={14} />
                      Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">AI Engine</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                      <CheckCircle2 size={14} />
                      Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Voice Gateway</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                      <AlertCircle size={14} />
                      High Latency
                    </span>
                  </div>
                </div>
              </section>

              <section className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/20">
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Danger Zone</h3>
                <div className="space-y-4">
                  <button className="w-full py-3 rounded-xl border border-slate-700 text-sm font-bold hover:bg-slate-800 transition-all">
                    Suspend Organization
                  </button>
                  <button className="w-full py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all">
                    Delete All Data
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
