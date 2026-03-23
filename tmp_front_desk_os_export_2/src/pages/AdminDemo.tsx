import React from 'react';
import { 
  Play, 
  Monitor, 
  Smartphone, 
  Settings, 
  RefreshCw, 
  Shield, 
  Zap, 
  MessageSquare, 
  PhoneCall, 
  ChevronRight,
  Sparkles,
  Layout
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminDemo: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
      {/* Header */}
      <header className="h-20 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <Monitor size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Shield className="text-primary" size={14} />
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Admin Demo Environment</span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Interactive Sandbox</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
            <Play size={18} />
            Launch Demo
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-12 gap-12">
        {/* Demo Config */}
        <aside className="w-96 space-y-8 overflow-y-auto shrink-0">
          <section className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-6">Demo Configuration</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Organization</label>
                <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all appearance-none">
                  <option>Acme Dental (Healthcare)</option>
                  <option>Global Real Estate (Property)</option>
                  <option>Tech Solutions (SaaS)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demo Persona</label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="p-3 rounded-xl border border-primary bg-primary/10 text-primary text-xs font-bold">Admin View</button>
                  <button className="p-3 rounded-xl border border-slate-700 bg-slate-900 text-slate-400 text-xs font-bold hover:border-slate-500 transition-all">Operator View</button>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-700">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Initial State</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Pre-populate Leads', active: true },
                    { label: 'Simulate Active Calls', active: false },
                    { label: 'Mock Billing Data', active: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">{item.label}</span>
                      <div className={cn(
                        "h-5 w-9 rounded-full relative cursor-pointer transition-all",
                        item.active ? "bg-primary" : "bg-slate-700"
                      )}>
                        <div className={cn(
                          "absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all",
                          item.active ? "right-1" : "left-1"
                        )}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-primary/5 border border-primary/10 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="text-primary" size={20} />
              <h4 className="text-sm font-bold text-white">Quick Simulation</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Instantly trigger common events to test the application's response and UI states.
            </p>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all">
                <span>Incoming AI Call</span>
                <PhoneCall size={14} className="text-primary" />
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all">
                <span>New High-Priority Lead</span>
                <Zap size={14} className="text-amber-500" />
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all">
                <span>System Error Alert</span>
                <RefreshCw size={14} className="text-red-500" />
              </button>
            </div>
          </section>
        </aside>

        {/* Demo Preview */}
        <main className="flex-1 bg-slate-800/30 border border-slate-700 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
          <div className="h-12 bg-slate-800 border-b border-slate-700 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/50"></div>
                <div className="h-3 w-3 rounded-full bg-amber-500/50"></div>
                <div className="h-3 w-3 rounded-full bg-emerald-500/50"></div>
              </div>
              <div className="h-6 w-px bg-slate-700 mx-2"></div>
              <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-1 border border-slate-700">
                <Layout size={12} className="text-slate-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preview: Dashboard</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Smartphone size={16} className="text-slate-500 hover:text-white cursor-pointer transition-colors" />
              <Monitor size={16} className="text-primary cursor-pointer transition-colors" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-12 bg-slate-900/50 relative group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            <div className="text-center space-y-6 max-w-md relative z-10">
              <div className="h-24 w-24 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-600 mx-auto shadow-xl">
                <Monitor size={48} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Interactive Preview</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  The demo environment allows you to interact with the application as if it were live. 
                  Click "Launch Demo" to start the interactive session.
                </p>
              </div>
              <button className="px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 mx-auto">
                Launch Demo Session
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="h-10 bg-slate-800 border-t border-slate-700 px-6 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session Status: Idle</span>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">FPS: 60</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Latency: 0ms</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
