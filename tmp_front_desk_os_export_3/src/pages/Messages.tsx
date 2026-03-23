import React from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Phone, 
  Video, 
  Info, 
  Smile, 
  Paperclip, 
  Send,
  Check,
  CheckCheck,
  Clock,
  Calendar,
  Tag,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Messages: React.FC = () => {
  const [selectedThread, setSelectedThread] = React.useState(0);

  const threads = [
    { 
      id: 0,
      name: 'John Doe', 
      lastMsg: 'I will be there at 2 PM.', 
      time: '10:30 AM', 
      unread: 2, 
      type: 'Booking Request',
      context: 'Dental Consult • Tomorrow 2:00 PM',
      messages: [
        { sender: 'JD', text: "Hi, I'm interested in booking a dental consult next week. Do you have any openings on Tuesday?", time: '10:25 AM', isMe: false },
        { sender: 'ME', text: "Hello John! Yes, we have a few slots available on Tuesday. Would 2:00 PM or 4:30 PM work better for you?", time: '10:28 AM', isMe: true },
        { sender: 'JD', text: "2:00 PM works great! I will be there at 2 PM.", time: '10:30 AM', isMe: false },
      ]
    },
    { 
      id: 1,
      name: 'Sarah Smith', 
      lastMsg: 'Can we reschedule?', 
      time: '9:45 AM', 
      unread: 0, 
      type: 'Lead',
      context: 'New Patient Inquiry',
      messages: [
        { sender: 'SS', text: "Hello, I saw your ad for teeth whitening. Can we reschedule my initial call?", time: '9:45 AM', isMe: false },
      ]
    },
    { 
      id: 2,
      name: 'Alice Cooper', 
      lastMsg: 'See you then.', 
      time: 'Mar 14', 
      unread: 0, 
      type: 'Call Follow-up',
      context: 'Missed Call • Mar 14',
      messages: [
        { sender: 'ME', text: "Hi Alice, sorry we missed your call. How can we help you today?", time: 'Mar 14, 2:00 PM', isMe: true },
        { sender: 'AC', text: "Just wanted to confirm my appointment. See you then.", time: 'Mar 14, 2:15 PM', isMe: false },
      ]
    },
  ];

  const currentThread = threads[selectedThread];

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Conversations List */}
      <aside className="w-80 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Inbox</h1>
            <button className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm hover:bg-primary/90 transition-all">
              <Plus size={18} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search threads..." 
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:border-primary outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.map((thread, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedThread(i)}
              className={cn(
                "p-4 border-b border-slate-100 flex gap-3 cursor-pointer hover:bg-slate-50 transition-all",
                selectedThread === i && "bg-primary/5 border-l-4 border-l-primary"
              )}
            >
              <div className="relative shrink-0">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm",
                  selectedThread === i ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {thread.name.split(' ').map(n => n[0]).join('')}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{thread.name}</h3>
                  <span className="text-[10px] font-medium text-slate-400">{thread.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 truncate font-medium">{thread.lastMsg}</p>
                  {thread.unread > 0 && (
                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                      {thread.unread}
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {thread.type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat Window */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
        {/* Chat Header */}
        <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
              {currentThread.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{currentThread.name}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{currentThread.context}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary transition-all"><Phone size={18} /></button>
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary transition-all"><Calendar size={18} /></button>
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary transition-all"><MoreVertical size={18} /></button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex justify-center">
            <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Conversation started</span>
          </div>

          {currentThread.messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3 max-w-[80%]", msg.isMe && "flex-row-reverse ml-auto")}>
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0",
                msg.isMe ? "bg-slate-200 text-slate-600" : "bg-primary/10 text-primary"
              )}>
                {msg.sender}
              </div>
              <div className={cn("space-y-1", msg.isMe && "flex flex-col items-end")}>
                <div className={cn(
                  "p-3 rounded-2xl shadow-sm border",
                  msg.isMe ? "bg-primary text-white border-primary rounded-tr-none" : "bg-white border-slate-200 text-slate-700 rounded-tl-none"
                )}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-medium">{msg.time}</span>
                  {msg.isMe && <CheckCheck size={12} className="text-primary" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <div className="p-6 bg-white border-t border-slate-200 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-1 flex items-center gap-2">
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 transition-all"><Smile size={20} /></button>
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 transition-all"><Paperclip size={20} /></button>
            <input 
              type="text" 
              placeholder="Type your response..." 
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
            />
            <button className="h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 hover:bg-primary/90 transition-all">
              <Send size={18} />
            </button>
          </div>
        </div>
      </main>

      {/* Context Sidebar */}
      <aside className="w-80 border-l border-slate-200 bg-slate-50/30 flex flex-col shrink-0 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-white">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Customer Context</h3>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg shadow-sm">
              {currentThread.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 leading-none mb-1">{currentThread.name}</h4>
              <p className="text-xs text-slate-500 font-medium">Customer since 2023</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Phone</span>
              <span className="font-bold text-slate-900">+1 (555) 000-0000</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Email</span>
              <span className="font-bold text-slate-900">john@example.com</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Related Activity</h3>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} className="text-primary" />
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Appointment</span>
                </div>
                <p className="text-xs font-bold text-slate-700">Dental Consult</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Tomorrow, 2:00 PM</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Phone size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Recent Call</span>
                </div>
                <p className="text-xs font-bold text-slate-700">Inbound Call</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Today, 10:20 AM • 4m 12s</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full rounded-xl bg-white border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                <Calendar size={14} />
                Book Appointment
              </button>
              <button className="w-full rounded-xl bg-white border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                <Tag size={14} />
                Add Label
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
