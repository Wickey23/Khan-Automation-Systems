import React from 'react';
import { 
  FlaskConical, 
  Play, 
  RefreshCw, 
  Terminal, 
  Cpu, 
  Zap, 
  Shield, 
  ChevronRight, 
  MessageSquare, 
  PhoneCall,
  Settings,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminTestingLab: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
      {/* Header */}
      <header className="h-20 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <FlaskConical size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Shield className="text-primary" size={14} />
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Admin Testing Lab</span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">AI Simulation Environment</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-700 transition-all flex items-center gap-2">
            <History size={18} />
            Test History
          </button>
          <button className="px-6 py-2 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
            <Play size={18} />
            Run Suite
          </button>
        </div>
      </header>

      {/* Main Lab Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Config */}
        <aside className="w-96 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto p-8 space-y-8">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Simulation Config</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Model Selection</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-all appearance-none">
                  <option>Gemini 1.5 Pro (Latest)</option>
                  <option>Gemini 1.5 Flash</option>
                  <option>GPT-4o (Proxy)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temperature</label>
                <input type="range" className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Test Scenarios</h3>
            <div className="space-y-2">
              {[
                { label: 'Appointment Booking', icon: PhoneCall, active: true },
                { label: 'Emergency Triage', icon: Shield, active: false },
                { label: 'Billing Inquiry', icon: Zap, active: false },
                { label: 'General FAQ', icon: MessageSquare, active: false },
              ].map((scenario, i) => (
                <button key={i} className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                  scenario.active ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:bg-slate-800"
                )}>
                  <scenario.icon size={18} />
                  {scenario.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">System Overrides</h3>
            <div className="space-y-3">
              {[
                'Bypass Rate Limiting',
                'Enable Debug Logging',
                'Mock External APIs',
                'Force Error States'
              ].map((override, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{override}</span>
                  <div className="h-5 w-9 rounded-full bg-slate-700 relative cursor-pointer">
                    <div className="absolute left-1 top-1 h-3 w-3 rounded-full bg-slate-400"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Panel: Console */}
        <main className="flex-1 flex flex-col overflow-hidden bg-black/40">
          <div className="h-12 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-primary" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Execution Log</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                System Ready
              </span>
              <button className="text-slate-500 hover:text-white transition-colors"><RefreshCw size={14} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-8 font-mono text-xs space-y-4">
            <div className="text-slate-500">[09:42:12] Initializing test environment...</div>
            <div className="text-slate-500">[09:42:13] Loading model: gemini-1.5-pro</div>
            <div className="text-slate-500">[09:42:14] Injecting context: Acme Dental (org_123)</div>
            <div className="text-primary">[09:42:15] Starting simulation: Appointment Booking</div>
            <div className="flex gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="text-emerald-500 shrink-0">USER:</div>
              <div className="text-slate-300">"Hi, I'd like to book an appointment for a cleaning next Tuesday."</div>
            </div>
            <div className="flex gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="text-primary shrink-0">AI:</div>
              <div className="text-slate-300">"Hello! I can certainly help with that. Looking at the schedule for Tuesday, we have openings at 10:00 AM and 2:30 PM. Which one works best for you?"</div>
            </div>
            <div className="text-slate-500 italic">[09:42:18] Tool Call: get_availability(date="2026-03-17")</div>
            <div className="text-slate-500 italic">[09:42:18] Response: {"{ slots: ['10:00', '14:30'] }"}</div>
          </div>
          <div className="p-6 border-t border-slate-800 bg-slate-900/50">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Type a manual prompt to override simulation..." 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 pl-6 pr-16 text-sm text-white focus:border-primary outline-none transition-all"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </main>

        {/* Right Panel: Metrics */}
        <aside className="w-80 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto p-8 space-y-8">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Real-time Metrics</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
                  <span>Latency</span>
                  <span className="text-emerald-500">1.2s</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: '30%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
                  <span>Token Usage</span>
                  <span className="text-primary">452 / 1M</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '15%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
                  <span>Accuracy Score</span>
                  <span className="text-emerald-500">98.2%</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: '98%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Detected Entities</h3>
            <div className="flex flex-wrap gap-2">
              {['Patient Name', 'Date', 'Time', 'Procedure', 'Provider'].map((entity, i) => (
                <span key={i} className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {entity}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5 mt-auto">
            <div className="flex items-center gap-3 mb-3">
              <Cpu className="text-primary" size={20} />
              <h4 className="text-xs font-bold text-white">Compute Health</h4>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Simulation engine is running on optimized US-EAST-1 clusters.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
