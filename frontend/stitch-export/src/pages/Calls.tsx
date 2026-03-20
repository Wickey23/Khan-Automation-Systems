import React, { useState } from 'react';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed, 
  Search, 
  Filter, 
  MoreVertical, 
  Play, 
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  User,
  Sparkles,
  Download,
  Share2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const calls = [
  { 
    id: 1, 
    contact: 'John Smith', 
    phone: '+1 (555) 012-3456', 
    type: 'incoming', 
    status: 'answered', 
    duration: '12m 45s', 
    time: '2 hours ago',
    outcome: 'Consultation Scheduled',
    summary: 'John was inquiring about the new HVAC system installation. He had questions about the warranty and maintenance costs. I successfully scheduled a consultation for next Tuesday at 10:00 AM.',
    recordingUrl: '#'
  },
  { 
    id: 2, 
    contact: 'Unknown Caller', 
    phone: '+1 (555) 019-8765', 
    type: 'incoming', 
    status: 'missed', 
    duration: '0m 0s', 
    time: 'Yesterday, 4:15 PM',
    outcome: 'No Voicemail',
    summary: 'System attempted AI redirect but caller hung up before connection.',
    recordingUrl: null
  },
  { 
    id: 3, 
    contact: 'Sarah Jones', 
    phone: '+1 (555) 014-5522', 
    type: 'outgoing', 
    status: 'answered', 
    duration: '5m 12s', 
    time: 'Oct 24, 10:30 AM',
    outcome: 'Follow-up Complete',
    summary: 'Called Sarah to confirm her appointment for tomorrow. She confirmed the time and mentioned she might be 5 minutes late.',
    recordingUrl: '#'
  },
  { 
    id: 4, 
    contact: 'Mike Doe', 
    phone: '+1 (555) 011-9988', 
    type: 'incoming', 
    status: 'answered', 
    duration: '8m 30s', 
    time: 'Oct 23, 09:12 AM',
    outcome: 'Information Provided',
    summary: 'Mike asked about pricing for the premium plan. I explained the features and sent him the pricing link via SMS.',
    recordingUrl: '#'
  },
];

export default function CallsPage() {
  const [expandedId, setExpandedId] = useState<number | null>(1);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Call Management</h1>
          <p className="text-on-surface-variant text-sm">Review and manage all AI-handled and manual calls.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={16} />
            <input 
              type="text" 
              placeholder="Search calls..."
              className="bg-surface-container-low border-none rounded-xl pl-9 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
          <button className="p-2 bg-surface-container-low text-on-surface-variant rounded-xl hover:bg-surface-container transition-colors">
            <Filter size={18} />
          </button>
        </div>
      </header>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant/10">
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Contact</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Type</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Duration</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Outcome</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Time</th>
                <th className="py-4 px-6 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {calls.map((call) => (
                <React.Fragment key={call.id}>
                  <tr 
                    className={cn(
                      "hover:bg-surface-container-low/30 transition-colors cursor-pointer group",
                      expandedId === call.id && "bg-primary/5"
                    )}
                    onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center",
                          call.status === 'missed' ? "bg-error-container/20 text-error" : "bg-primary-container/30 text-primary"
                        )}>
                          <User size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-on-surface">{call.contact}</div>
                          <div className="text-[11px] text-on-surface-variant">{call.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                        {call.type === 'incoming' ? <PhoneIncoming size={14} /> : <PhoneOutgoing size={14} />}
                        <span className="capitalize">{call.type}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                        call.status === 'answered' ? "bg-secondary-container text-on-secondary-container" : "bg-error/10 text-error"
                      )}>
                        {call.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-on-surface-variant font-medium">{call.duration}</td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-semibold text-on-surface">{call.outcome}</span>
                    </td>
                    <td className="py-4 px-6 text-right text-[11px] text-on-surface-variant font-medium">{call.time}</td>
                    <td className="py-4 px-6 text-right">
                      {expandedId === call.id ? <ChevronUp size={18} className="text-primary" /> : <ChevronDown size={18} className="text-on-surface-variant" />}
                    </td>
                  </tr>
                  {expandedId === call.id && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <div className="bg-primary/5 px-6 py-8 border-t border-primary/10 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4 space-y-6">
                              <div>
                                <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4">Call Recording</h4>
                                {call.recordingUrl ? (
                                  <div className="bg-white rounded-xl p-4 shadow-sm border border-primary/10">
                                    <div className="flex items-center gap-4 mb-4">
                                      <button className="w-10 h-10 primary-gradient rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                        <Play size={18} fill="currentColor" />
                                      </button>
                                      <div className="flex-1 h-1 bg-surface-container-highest rounded-full relative">
                                        <div className="absolute left-0 top-0 h-full w-1/3 bg-primary rounded-full"></div>
                                      </div>
                                      <span className="text-[10px] font-bold text-on-surface-variant">12:45</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <div className="flex gap-2">
                                        <button className="p-1.5 text-on-surface-variant hover:text-primary transition-colors"><Download size={16} /></button>
                                        <button className="p-1.5 text-on-surface-variant hover:text-primary transition-colors"><Share2 size={16} /></button>
                                      </div>
                                      <span className="text-[10px] font-bold text-on-surface-variant uppercase">24kbps • Mono</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-surface-container-low rounded-xl p-8 text-center border border-dashed border-outline-variant/30">
                                    <PhoneMissed className="mx-auto text-on-surface-variant/40 mb-2" size={32} />
                                    <p className="text-xs text-on-surface-variant font-medium">No recording available for missed calls.</p>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-lg border border-primary/5">
                                  <div className="text-[9px] font-bold text-on-surface-variant uppercase mb-1">Call ID</div>
                                  <div className="text-xs font-bold text-on-surface">#C-8842-X</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-primary/5">
                                  <div className="text-[9px] font-bold text-on-surface-variant uppercase mb-1">AI Agent</div>
                                  <div className="text-xs font-bold text-on-surface">ReceptionAI v2.4</div>
                                </div>
                              </div>
                            </div>

                            <div className="lg:col-span-8">
                              <div className="flex items-center gap-2 mb-4">
                                <Sparkles size={16} className="text-primary" />
                                <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest">AI Transcription Summary</h4>
                              </div>
                              <div className="bg-white rounded-xl p-6 shadow-sm border border-primary/10">
                                <p className="text-sm text-on-surface leading-relaxed mb-6">
                                  {call.summary}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-surface-container-high text-on-surface-variant">HVAC INSTALLATION</span>
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-surface-container-high text-on-surface-variant">WARRANTY INQUIRY</span>
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-surface-container-high text-on-surface-variant">BOOKING CONFIRMED</span>
                                </div>
                              </div>
                              <div className="mt-4 flex justify-end gap-3">
                                <button className="text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors">Flag for Review</button>
                                <button className="text-xs font-bold text-primary hover:underline">View Full Transcript</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-surface-container-low/30 px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant font-medium">Showing 4 of 1,284 calls</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-xs font-bold text-on-surface-variant bg-white border border-outline-variant/20 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1.5 text-xs font-bold text-on-surface bg-white border border-outline-variant/20 rounded-lg hover:bg-surface-container transition-colors">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
