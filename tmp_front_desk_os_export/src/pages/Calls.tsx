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
  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Icon Rail */}
      <aside className="flex w-16 flex-col items-center border-r border-slate-200 bg-slate-50 py-4 shrink-0">
        <div className="flex flex-col gap-4">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <Phone size={20} />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 transition-colors">
            <History size={20} />
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
              <h1 className="text-lg font-semibold">Call Queue</h1>
              <div className="flex items-center gap-1 rounded bg-slate-100 p-0.5">
                <button className="px-3 py-1 text-xs font-semibold rounded bg-white shadow-sm">Active (4)</button>
                <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700">Pending</button>
                <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700">Completed</button>
              </div>
            </div>
            <button className="flex h-8 items-center gap-1 rounded border border-slate-200 px-2.5 text-xs font-medium hover:bg-slate-50">
              <Search size={14} className="mr-1" />
              Sort: Newest
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Caller Info</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Duration</th>
                  <th className="px-4 py-3 text-right">Time</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { name: 'John Doe', phone: '+1 (555) 012-3456', status: 'IN PROGRESS', duration: '02:45', time: '10:30 AM', active: true },
                  { name: 'Alice Moore', phone: '+1 (555) 987-6543', status: 'ON HOLD', duration: '05:12', time: '10:28 AM', active: false },
                  { name: 'Samuel Wright', phone: '+1 (555) 231-8890', status: 'IN QUEUE', duration: '00:00', time: '10:25 AM', active: false },
                  { name: 'Karen Lewis', phone: '+1 (555) 445-1122', status: 'IN QUEUE', duration: '00:00', time: '10:22 AM', active: false },
                ].map((call, i) => (
                  <tr key={i} className={cn("group hover:bg-primary/5 cursor-pointer", call.active && "bg-primary/10")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                          {call.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{call.name}</div>
                          <div className="text-[11px] text-slate-500">{call.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                        call.status === 'IN PROGRESS' ? "bg-green-100 text-green-700" :
                        call.status === 'ON HOLD' ? "bg-orange-100 text-orange-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {call.status === 'IN PROGRESS' && <span className="mr-1 h-1 w-1 rounded-full bg-green-500 animate-pulse"></span>}
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{call.duration}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500 font-medium">{call.time}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight size={18} className={cn(call.active ? "text-primary" : "text-slate-400")} />
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
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">JD</div>
              <div>
                <h3 className="text-sm font-bold">John Doe</h3>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Call • 02:45</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><Phone size={18} /></button>
              <button className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><Pause size={18} /></button>
              <button className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors"><X size={18} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Transcript</h4>
                <span className="text-[10px] font-medium text-primary flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span> Listening
                </span>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <span className="text-[11px] font-bold text-primary shrink-0 w-12 uppercase">JD:</span>
                  <p className="text-sm text-slate-600 italic">"Hi, I was calling to confirm my appointment for tomorrow at 2 PM with Dr. Aris."</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0 w-12 uppercase">AI:</span>
                  <p className="text-sm text-slate-700">"Of course, Mr. Doe. Let me check our records for you. Yes, I see you scheduled for a routine check-up."</p>
                </div>
                <div className="flex gap-3 bg-primary/5 p-3 rounded-lg border border-primary/10">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0 w-12 uppercase">AI:</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">"The card on file is still valid until next year, so you won't need to bring it unless something has changed. Is there anything else?"</p>
                    <div className="mt-2 flex gap-2">
                      <button className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded hover:border-primary transition-colors">Edit Response</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Quick Follow-up SMS</h4>
              <div className="rounded-lg border border-slate-200 bg-white p-1">
                <textarea 
                  className="w-full resize-none border-none bg-transparent p-3 text-sm focus:ring-0 placeholder:text-slate-400" 
                  placeholder="Type a follow-up message..." 
                  rows={3}
                ></textarea>
                <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                  <div className="flex gap-1 text-slate-400">
                    <Smile size={18} className="cursor-pointer hover:text-primary" />
                    <Paperclip size={18} className="cursor-pointer hover:text-primary" />
                    <Clock size={18} className="cursor-pointer hover:text-primary" />
                  </div>
                  <button className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-primary/90">
                    Send SMS
                    <Send size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {['📍 Directions', '📅 Appointment Link', '📋 Intake Form'].map(tag => (
                  <button key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200 transition-colors border border-slate-200">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 p-6 bg-white shrink-0">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-bold uppercase tracking-widest text-slate-400">Patient File Highlights</span>
              <button className="font-bold text-primary hover:underline">View Full Profile</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded bg-slate-50 p-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Last Visit</p>
                <p className="text-xs font-semibold">Oct 12, 2023</p>
              </div>
              <div className="rounded bg-slate-50 p-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Insurance</p>
                <p className="text-xs font-semibold">BlueCross PPO</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
