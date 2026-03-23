import React from 'react';
import { 
  Phone, 
  History, 
  User, 
  Mic, 
  Info, 
  Search, 
  ChevronRight, 
  Pause, 
  X, 
  Smile,
  Paperclip,
  Clock,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Calls: React.FC = () => {
  const [selectedCall, setSelectedCall] = React.useState(0);

  const calls = [
    { 
      id: 0,
      name: 'John Doe', 
      phone: '+1 (555) 012-3456', 
      status: 'Booking Request', 
      duration: '02:45', 
      time: '10:30 AM', 
      service: 'Dental Implant',
      preferredDate: 'Oct 24, 2023',
      summary: 'Patient is looking for a dental implant consultation. Experienced pain for 2 weeks. Has BlueCross insurance.',
      transcript: [
        { speaker: 'JD', text: 'Hi, I was calling to confirm my appointment for tomorrow at 2 PM with Dr. Aris.' },
        { speaker: 'AI', text: 'Of course, Mr. Doe. Let me check our records for you. Yes, I see you scheduled for a routine check-up.' },
        { speaker: 'JD', text: 'Actually, I wanted to talk about an implant. I\'ve been in a lot of pain lately.' }
      ]
    },
    { 
      id: 1,
      name: 'Alice Moore', 
      phone: '+1 (555) 987-6543', 
      status: 'Voicemail', 
      duration: '00:45', 
      time: '10:28 AM', 
      service: 'Routine Cleaning',
      preferredDate: 'Next Week',
      summary: 'Left a voicemail regarding a cleaning appointment. Sounded urgent but didn\'t specify a date.',
      transcript: [
        { speaker: 'AM', text: 'Hi, this is Alice. I need to schedule a cleaning. Please call me back at this number.' }
      ]
    },
    { 
      id: 2,
      name: 'Samuel Wright', 
      phone: '+1 (555) 231-8890', 
      status: 'Transferred', 
      duration: '05:12', 
      time: '10:25 AM', 
      service: 'Billing Inquiry',
      preferredDate: 'N/A',
      summary: 'Patient had questions about their recent invoice. Transferred to the billing department after initial intake.',
      transcript: [
        { speaker: 'SW', text: 'I have a question about my last bill. It seems higher than usual.' },
        { speaker: 'AI', text: 'I can certainly help with that. Let me transfer you to our billing specialist.' }
      ]
    },
    { 
      id: 3,
      name: 'Karen Lewis', 
      phone: '+1 (555) 445-1122', 
      status: 'Spam', 
      duration: '00:12', 
      time: '10:22 AM', 
      service: 'Unknown',
      preferredDate: 'N/A',
      summary: 'Automated telemarketing call detected and flagged as spam.',
      transcript: [
        { speaker: 'Bot', text: 'Congratulations! You have won a free trip to...' }
      ]
    },
    { 
      id: 4,
      name: 'Michael Chen', 
      phone: '+1 (555) 778-9900', 
      status: 'Resolved', 
      duration: '03:20', 
      time: '09:45 AM', 
      service: 'Follow-up',
      preferredDate: 'Today',
      summary: 'Patient called to confirm their arrival for today\'s 10 AM appointment. Confirmed and checked in.',
      transcript: [
        { speaker: 'MC', text: 'I\'m just pulling into the parking lot for my 10:00 appointment.' },
        { speaker: 'AI', text: 'Perfect, Mr. Chen. We have you checked in. See you inside!' }
      ]
    },
  ];

  const currentCall = calls[selectedCall];

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Icon Rail */}
      <aside className="flex w-16 flex-col items-center border-r border-slate-200 bg-slate-50 py-4 shrink-0">
        <div className="flex flex-col gap-4">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <History size={20} />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 transition-colors">
            <Phone size={20} />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 transition-colors">
            <User size={20} />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 transition-colors">
            <Mic size={20} />
          </button>
        </div>
        <div className="mt-auto flex flex-col gap-4">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 transition-colors">
            <Info size={20} />
          </button>
        </div>
      </aside>

      <div className="flex flex-1 overflow-hidden">
        {/* Call Queue List */}
        <section className="flex flex-[2] flex-col overflow-hidden border-r border-slate-200">
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-slate-900">Reviewed Calls</h1>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button className="px-3 py-1 text-xs font-bold rounded-md bg-white shadow-sm text-primary">To Review (12)</button>
                <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700">Resolved</button>
                <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700">Spam</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search calls..." 
                  className="h-8 w-40 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs focus:border-primary outline-none"
                />
              </div>
              <button className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Sort: Newest
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Caller</th>
                  <th className="px-6 py-3">Outcome</th>
                  <th className="px-6 py-3 text-right">Duration</th>
                  <th className="px-6 py-3 text-right">Time</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((call, i) => (
                  <tr 
                    key={i} 
                    onClick={() => setSelectedCall(i)}
                    className={cn(
                      "group hover:bg-slate-50 cursor-pointer transition-colors", 
                      selectedCall === i && "bg-primary/5"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm",
                          selectedCall === i ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          {call.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{call.name}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{call.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        call.status === 'Booking Request' ? "bg-emerald-100 text-emerald-700" :
                        call.status === 'Voicemail' ? "bg-amber-100 text-amber-700" :
                        call.status === 'Transferred' ? "bg-blue-100 text-blue-700" :
                        call.status === 'Spam' ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-700"
                      )}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-600">{call.duration}</td>
                    <td className="px-6 py-4 text-right text-[11px] text-slate-400 font-bold">{call.time}</td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight size={16} className={cn(selectedCall === i ? "text-primary" : "text-slate-300")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Call Detail Pane */}
        <section className="flex flex-[1.5] flex-col overflow-hidden bg-slate-50/30">
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-6 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {currentCall.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{currentCall.name}</h3>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{currentCall.status} • {currentCall.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-8 px-3 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200 transition-colors">Mark Resolved</button>
              <button className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"><X size={16} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* AI Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="text-primary" size={16} />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">AI Summary</h4>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {currentCall.summary}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Service Type</p>
                  <p className="text-xs font-bold text-slate-900">{currentCall.service}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Preferred Date</p>
                  <p className="text-xs font-bold text-slate-900">{currentCall.preferredDate}</p>
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">Call Transcript</h4>
              <div className="space-y-4 px-1">
                {currentCall.transcript.map((line, i) => (
                  <div key={i} className="flex gap-3">
                    <span className={cn(
                      "text-[10px] font-bold shrink-0 w-8 uppercase mt-1",
                      line.speaker === 'AI' ? "text-primary" : "text-slate-400"
                    )}>{line.speaker}:</span>
                    <p className={cn(
                      "text-sm leading-relaxed",
                      line.speaker === 'AI' ? "text-slate-700" : "text-slate-600 italic"
                    )}>"{line.text}"</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Follow-up SMS */}
            <div className="border-t border-slate-200 pt-8">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Quick Follow-up SMS</h4>
              <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <textarea 
                  className="w-full resize-none border-none bg-transparent p-4 text-sm focus:ring-0 placeholder:text-slate-400 font-medium" 
                  placeholder={`Send a follow-up to ${currentCall.name.split(' ')[0]}...`} 
                  rows={3}
                ></textarea>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <div className="flex gap-2 text-slate-400">
                    <Smile size={18} className="cursor-pointer hover:text-primary transition-colors" />
                    <Paperclip size={18} className="cursor-pointer hover:text-primary transition-colors" />
                    <Clock size={18} className="cursor-pointer hover:text-primary transition-colors" />
                  </div>
                  <button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                    Send SMS
                    <Send size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {['📍 Directions', '📅 Booking Link', '📋 Intake Form'].map(tag => (
                  <button key={tag} className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-white hover:border-primary/30 transition-all border border-slate-200">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
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
