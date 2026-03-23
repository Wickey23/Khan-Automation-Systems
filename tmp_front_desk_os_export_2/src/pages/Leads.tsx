import React from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight, 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare, 
  Tag, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  User,
  ArrowRight,
  ExternalLink,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Leads: React.FC = () => {
  const [selectedLead, setSelectedLead] = React.useState(0);

  const leads = [
    { 
      id: 0,
      name: 'Robert Fox', 
      email: 'robert@example.com', 
      phone: '(555) 012-3456', 
      status: 'New Inquiry', 
      urgency: 'High', 
      time: '12 mins ago', 
      action: 'Call Back Now', 
      source: 'Google Ads',
      summary: 'Caller is looking for a dental implant consultation. They mentioned they have been experiencing pain for 2 weeks and are looking for an urgent appointment. They have BlueCross insurance.',
      color: 'text-red-600', 
      bg: 'bg-red-50' 
    },
    { 
      id: 1,
      name: 'Jane Cooper', 
      email: 'jane@example.com', 
      phone: '(555) 987-6543', 
      status: 'Awaiting Reply', 
      urgency: 'Medium', 
      time: '45 mins ago', 
      action: 'Send SMS Follow-up', 
      source: 'Web Form',
      summary: 'Requested information about routine cleaning pricing. Sent initial quote, awaiting confirmation of preferred date.',
      color: 'text-amber-600', 
      bg: 'bg-amber-50' 
    },
    { 
      id: 2,
      name: 'Cody Fisher', 
      phone: '(555) 231-8890', 
      status: 'Missed Call', 
      urgency: 'High', 
      time: '1 hr ago', 
      action: 'Call Back Now', 
      source: 'Direct Dial',
      summary: 'Missed call from a potential new patient. No voicemail left, but number is not in database. High priority for callback.',
      color: 'text-red-600', 
      bg: 'bg-red-50' 
    },
    { 
      id: 3,
      name: 'Esther Howard', 
      email: 'esther@example.com', 
      phone: '(555) 445-1122', 
      status: 'Qualified', 
      urgency: 'Low', 
      time: '3 hrs ago', 
      action: 'Book Appointment', 
      source: 'Referral',
      summary: 'Referral from Dr. Smith. Looking for a second opinion on a root canal. Already qualified, just needs a slot.',
      color: 'text-slate-600', 
      bg: 'bg-slate-50' 
    },
    { 
      id: 4,
      name: 'Jenny Wilson', 
      email: 'jenny@example.com', 
      phone: '(555) 667-2233', 
      status: 'Contacted', 
      urgency: 'Medium', 
      time: '5 hrs ago', 
      action: 'Check Status', 
      source: 'Facebook',
      summary: 'Inquired about whitening services. Spoke briefly, she needs to check her schedule and call back.',
      color: 'text-amber-600', 
      bg: 'bg-amber-50' 
    },
  ];

  const currentLead = leads[selectedLead];

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-slate-900">Lead Queue</h1>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button className="px-3 py-1 text-xs font-bold rounded-md bg-white shadow-sm text-primary">Active Leads (8)</button>
              <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700">Archived</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search leads..." 
                className="h-8 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs focus:border-primary outline-none"
              />
            </div>
            <button className="flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white shadow-sm hover:bg-primary/90">
              <Plus size={14} />
              Add Lead
            </button>
          </div>
        </div>

        {/* Leads Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Lead Info</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Urgency</th>
                <th className="px-6 py-3">Last Activity</th>
                <th className="px-6 py-3 text-right">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead, i) => (
                <tr 
                  key={i} 
                  onClick={() => setSelectedLead(i)}
                  className={cn(
                    "group hover:bg-slate-50 cursor-pointer transition-colors",
                    selectedLead === i && "bg-primary/5"
                  )}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm",
                        selectedLead === i ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {lead.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{lead.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{lead.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Tag size={12} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">{lead.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", lead.bg, lead.color)}>
                      <AlertCircle size={10} />
                      {lead.urgency}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold uppercase tracking-tighter">
                      <Clock size={12} />
                      {lead.time}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all uppercase tracking-wider",
                      lead.urgency === 'High' ? "bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary/90" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}>
                      {lead.action}
                      <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Detail Sidebar */}
      <aside className="w-96 border-l border-slate-200 bg-slate-50/30 flex flex-col flex-shrink-0 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xl shadow-sm">
              {currentLead.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex gap-2">
              <button className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:text-primary hover:border-primary transition-all shadow-sm bg-white"><Phone size={18} /></button>
              <button className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:text-primary hover:border-primary transition-all shadow-sm bg-white"><MessageSquare size={18} /></button>
              <button className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:text-primary hover:border-primary transition-all shadow-sm bg-white"><MoreVertical size={18} /></button>
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{currentLead.name}</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lead via {currentLead.source} • {currentLead.time}</p>
          
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1", currentLead.bg, currentLead.color)}>
              <AlertCircle size={10} /> {currentLead.urgency} Urgency
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Tag size={10} /> {currentLead.status}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* AI Context / Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="text-primary" size={16} />
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Operator Context</h4>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
              "{currentLead.summary}"
            </p>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">Lead Details</h3>
            <div className="space-y-4 px-1">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400"><Phone size={14} /></div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Phone</p>
                  <p className="text-xs font-bold text-slate-900">{currentLead.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400"><Mail size={14} /></div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Email</p>
                  <p className="text-xs font-bold text-slate-900">{currentLead.email || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400"><User size={14} /></div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Source</p>
                  <p className="text-xs font-bold text-slate-900">{currentLead.source}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">Primary Action</h3>
            <div className="space-y-3">
              <button className="w-full rounded-xl bg-primary py-3.5 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                <Phone size={16} />
                {currentLead.action}
              </button>
              <button className="w-full rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                <Calendar size={16} />
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

const Sparkles: React.FC<{ size?: number, className?: string }> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
    <path d="M5 3v4"></path>
    <path d="M19 17v4"></path>
    <path d="M3 5h4"></path>
    <path d="M17 19h4"></path>
  </svg>
);
