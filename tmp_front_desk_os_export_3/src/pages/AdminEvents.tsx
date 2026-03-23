import React from 'react';
import { 
  Shield, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight, 
  Clock, 
  Activity, 
  Database, 
  Zap, 
  Phone, 
  MessageSquare,
  Terminal,
  Code,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminEvents: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = React.useState(0);

  const events = [
    { id: 'evt_9428', type: 'Call Started', org: 'Acme Dental', time: '2 mins ago', status: 'Success', icon: Phone, color: 'text-blue-500', bg: 'bg-blue-50', payload: { call_id: 'call_9428', from: '+15551234567', to: '+15550001111', direction: 'inbound', provider: 'twilio' } },
    { id: 'evt_9427', type: 'Inference Success', org: 'Acme Dental', time: '2 mins ago', status: 'Success', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50', payload: { model: 'gemini-3-flash', tokens: 42, latency: '120ms', prompt_id: 'p_dental_v1' } },
    { id: 'evt_9426', type: 'SMS Sent', org: 'Global RE', time: '14 mins ago', status: 'Success', icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-50', payload: { msg_id: 'msg_101', to: '+15559876543', body: 'Your listing details have been sent.', provider: 'twilio' } },
    { id: 'evt_9425', type: 'DB Write', org: 'Tech Sol', time: '28 mins ago', status: 'Success', icon: Database, color: 'text-purple-500', bg: 'bg-purple-50', payload: { collection: 'leads', doc_id: 'lead_789', operation: 'update', fields: ['status', 'urgency'] } },
    { id: 'evt_9424', type: 'Auth Login', org: 'System', time: '1 hour ago', status: 'Info', icon: Shield, color: 'text-slate-500', bg: 'bg-slate-50', payload: { user_id: 'usr_123', ip: '192.168.1.1', user_agent: 'Mozilla/5.0...' } },
  ];

  const currentEvent = events[selectedEvent];

  return (
    <div className="flex-1 flex overflow-hidden bg-background-light">
      {/* Event List */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200">
        <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="text-primary" size={16} />
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Global Control Plane</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Event Inspector</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold uppercase tracking-wider">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Live Streaming
            </div>
          </div>
        </header>

        <div className="h-16 bg-white border-b border-slate-200 px-12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Filter by Event ID, Type, or Org..." 
                className="w-96 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary outline-none transition-all"
              />
            </div>
          </div>
          <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all">
            <Filter size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                <th className="px-8 py-4">Event</th>
                <th className="px-8 py-4">Organization</th>
                <th className="px-8 py-4">Timestamp</th>
                <th className="px-8 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event, i) => (
                <tr 
                  key={i} 
                  onClick={() => setSelectedEvent(i)}
                  className={cn(
                    "hover:bg-slate-50 transition-colors cursor-pointer group",
                    selectedEvent === i && "bg-primary/5"
                  )}
                >
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", event.bg, event.color)}>
                        <event.icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{event.type}</p>
                        <p className="text-[10px] font-mono text-slate-400">{event.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className="text-xs font-medium text-slate-600">{event.org}</span>
                  </td>
                  <td className="px-8 py-4">
                    <span className="text-xs text-slate-400 font-medium">{event.time}</span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                      event.status === 'Success' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {event.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Detail Pane */}
      <aside className="w-[450px] bg-white flex flex-col shrink-0 overflow-hidden">
        <header className="h-24 border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Event Detail</h3>
            <h2 className="text-lg font-bold text-slate-900">{currentEvent.type}</h2>
          </div>
          <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-all">
            <MoreVertical size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Terminal size={14} />
              Payload Data
            </h4>
            <div className="rounded-2xl bg-slate-900 p-6 font-mono text-xs leading-relaxed text-emerald-400 shadow-xl overflow-x-auto">
              <pre>{JSON.stringify(currentEvent.payload, null, 2)}</pre>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Activity size={14} />
              Tracing
            </h4>
            <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-200">
              {[
                { label: 'Event Received', time: '03:27:46.120', status: 'Completed' },
                { label: 'Validation Passed', time: '03:27:46.125', status: 'Completed' },
                { label: 'Routing to Worker', time: '03:27:46.130', status: 'Completed' },
                { label: 'Processing Finished', time: '03:27:46.250', status: 'Completed' },
              ].map((step, i) => (
                <div key={i} className="relative pl-10">
                  <div className="absolute left-3 top-1.5 h-2 w-2 rounded-full bg-primary border-2 border-white"></div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">{step.label}</p>
                    <span className="text-[10px] font-mono text-slate-400">{step.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-6 border-t border-slate-100">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                <Code size={14} />
                Copy JSON
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                <Eye size={14} />
                Raw View
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
};
