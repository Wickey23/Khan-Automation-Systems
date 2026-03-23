import React from 'react';
import { 
  Phone, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight, 
  Play, 
  Download, 
  Shield,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminCalls: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Global Control Plane</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Global Call Review</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Streams</span>
            <span className="text-lg font-black text-white">42</span>
          </div>
          <button className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all border border-slate-700">
            Export Logs
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
              placeholder="Search by Call ID, Org, or Number..." 
              className="w-96 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button className="px-4 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-primary">All Calls</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Failed</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">High Latency</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Flagged</button>
          </div>
        </div>
        <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all">
          <Filter size={20} />
        </button>
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-6 py-4">Call ID / Org</th>
                <th className="px-6 py-4">Participant</th>
                <th className="px-6 py-4">Duration / Cost</th>
                <th className="px-6 py-4">AI Metrics</th>
                <th className="px-6 py-4">Gateway</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { id: 'call_9428', org: 'Acme Dental', phone: '+1 (555) 123-4567', duration: '4m 12s', cost: '$0.42', latency: '120ms', tokens: '1.2k', gateway: 'Twilio-US-1', status: 'Success', color: 'text-emerald-500' },
                { id: 'call_9427', org: 'Global RE', phone: '+1 (555) 987-6543', duration: '1m 45s', cost: '$0.18', latency: '450ms', tokens: '450', gateway: 'Twilio-US-1', status: 'Warning', color: 'text-amber-500', sub: 'High Latency' },
                { id: 'call_9426', org: 'Tech Sol', phone: '+1 (555) 000-1111', duration: '0m 12s', cost: '$0.02', latency: 'N/A', tokens: '12', gateway: 'Vapi-EU-1', status: 'Failed', color: 'text-red-500', sub: 'Inference Error' },
                { id: 'call_9425', org: 'Acme Dental', phone: '+1 (555) 222-3333', duration: '12m 05s', cost: '$1.20', latency: '105ms', tokens: '4.8k', gateway: 'Twilio-US-1', status: 'Success', color: 'text-emerald-500' },
                { id: 'call_9424', org: 'Health First', phone: '+1 (555) 444-5555', duration: '3m 22s', cost: '$0.35', latency: '135ms', tokens: '980', gateway: 'Twilio-US-1', status: 'Success', color: 'text-emerald-500' },
                { id: 'call_9423', org: 'Quick Fix', phone: '+1 (555) 666-7777', duration: '5m 10s', cost: '$0.55', latency: '150ms', tokens: '1.5k', gateway: 'Twilio-US-1', status: 'Success', color: 'text-emerald-500' },
              ].map((call, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{call.id}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 size={10} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{call.org}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <Phone size={12} />
                      </div>
                      <span className="text-xs font-medium text-slate-700">{call.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={10} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">{call.duration}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{call.cost}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 rounded-full bg-slate-100 overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full", call.status === 'Success' ? "bg-emerald-500" : "bg-amber-500")} 
                            style={{ width: call.status === 'Success' ? '95%' : '40%' }}
                          ></div>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500">{call.latency}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{call.tokens} tokens</p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-[10px] font-mono text-slate-500">{call.gateway}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider", call.color)}>{call.status}</span>
                      {call.sub && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{call.sub}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                        <Play size={16} />
                      </button>
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
