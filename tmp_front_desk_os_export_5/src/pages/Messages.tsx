import React from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Send, 
  Paperclip, 
  Smile, 
  Phone, 
  Video, 
  Info,
  Check,
  CheckCheck,
  Clock,
  User,
  Calendar,
  PhoneCall,
  UserPlus,
  Tag,
  AlertCircle,
  MessageSquare,
  Inbox,
  Archive,
  Star,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Messages: React.FC = () => {
  const [selectedThread, setSelectedThread] = React.useState(0);

  const threads = [
    { 
      id: 0,
      name: 'Alice Cooper', 
      lastMessage: 'I need to reschedule my consultation for next Tuesday.', 
      time: '10:24 AM', 
      unread: 2, 
      type: 'Booking Request',
      status: 'active',
      avatar: 'AC'
    },
    { 
      id: 1,
      name: 'Bob Wilson', 
      lastMessage: 'Thanks for the reminder! I will be there.', 
      time: '9:45 AM', 
      unread: 0, 
      type: 'Confirmation',
      status: 'online',
      avatar: 'BW'
    },
    { 
      id: 2,
      name: 'Charlie Brown', 
      lastMessage: 'Does my insurance cover the follow-up?', 
      time: 'Yesterday', 
      unread: 0, 
      type: 'Billing Inquiry',
      status: 'away',
      avatar: 'CB'
    },
    { 
      id: 3,
      name: 'Diana Prince', 
      lastMessage: 'Emergency: I have severe tooth pain.', 
      time: 'Yesterday', 
      unread: 0, 
      type: 'Emergency',
      status: 'offline',
      avatar: 'DP'
    },
  ];

  const messages = [
    { id: 0, sender: 'Alice Cooper', text: 'Hi, I have an appointment for a consultation next Tuesday.', time: '10:20 AM', isMe: false },
    { id: 1, sender: 'Me', text: 'Hello Alice! Yes, I see your appointment for Tuesday at 2:00 PM.', time: '10:22 AM', isMe: true },
    { id: 2, sender: 'Alice Cooper', text: 'I need to reschedule my consultation for next Tuesday. Something came up at work.', time: '10:24 AM', isMe: false },
  ];

  const currentThread = threads[selectedThread];

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Thread List */}
      <div className="w-80 border-r border-slate-200 flex flex-col shrink-0 bg-slate-50/30">
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Inbox size={18} />
            </div>
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Operator Inbox</h1>
          </div>
          <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-all">
            <Filter size={18} />
          </button>
        </header>

        <div className="p-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-xs focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threads.map((thread, i) => (
            <div 
              key={thread.id}
              onClick={() => setSelectedThread(i)}
              className={cn(
                "px-6 py-4 cursor-pointer transition-all border-l-2",
                selectedThread === i 
                  ? "bg-white border-primary shadow-sm" 
                  : "border-transparent hover:bg-slate-100/50"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{thread.name}</span>
                  {thread.unread > 0 && (
                    <span className="h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center">
                      {thread.unread}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-slate-400">{thread.time}</span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-1 mb-2 leading-relaxed">
                {thread.lastMessage}
              </p>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                  thread.type === 'Emergency' ? "bg-red-50 text-red-600" :
                  thread.type === 'Booking Request' ? "bg-amber-50 text-amber-600" :
                  "bg-slate-100 text-slate-500"
                )}>
                  {thread.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="h-16 border-b border-slate-200 px-8 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shadow-sm">
                {currentThread.avatar}
              </div>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                currentThread.status === 'online' ? "bg-emerald-500" :
                currentThread.status === 'away' ? "bg-amber-500" : "bg-slate-300"
              )}></div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{currentThread.name}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentThread.type} • Active Now</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"><Phone size={18} /></button>
            <button className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"><Video size={18} /></button>
            <div className="w-px h-6 bg-slate-200 mx-2"></div>
            <button className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"><MoreVertical size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.isMe ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[70%] space-y-1",
                msg.isMe ? "items-end" : "items-start"
              )}>
                <div className={cn(
                  "px-5 py-3.5 rounded-2xl text-sm shadow-sm",
                  msg.isMe 
                    ? "bg-slate-900 text-white rounded-tr-none" 
                    : "bg-white border border-slate-200 text-slate-700 rounded-tl-none"
                )}>
                  {msg.text}
                </div>
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] font-medium text-slate-400">{msg.time}</span>
                  {msg.isMe && <CheckCheck size={12} className="text-primary" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="p-6 border-t border-slate-200 bg-white">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 p-2 focus-within:border-primary transition-all">
              <textarea 
                placeholder="Type a message..." 
                className="w-full bg-transparent border-none outline-none text-sm p-2 resize-none min-h-[44px] max-h-32"
                rows={1}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition-all"><Smile size={18} /></button>
                  <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition-all"><Paperclip size={18} /></button>
                </div>
                <button className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Context Pane */}
      <aside className="w-80 border-l border-slate-200 bg-slate-50/50 flex flex-col shrink-0 overflow-hidden">
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Patient Context</h2>
          <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><Info size={18} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Quick Profile */}
          <div className="text-center">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-2xl mx-auto mb-4 shadow-inner">
              {currentThread.avatar}
            </div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">{currentThread.name}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">+1 (555) 000-0000</p>
            <div className="flex justify-center gap-2 mt-4">
              <button className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest">View Profile</button>
              <button className="px-4 py-2 rounded-xl bg-slate-900 text-[10px] font-bold text-white hover:bg-slate-800 transition-all uppercase tracking-widest">Edit</button>
            </div>
          </div>

          {/* Related Entities */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Related Activity</h4>
            
            {/* Booking Link */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm group cursor-pointer hover:border-primary transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Calendar size={12} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Booking Request</span>
                </div>
                <ChevronRight size={12} className="text-slate-300 group-hover:text-primary transition-all" />
              </div>
              <p className="text-xs font-bold text-slate-700">Dental Consult</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Next Tuesday, 2:00 PM</p>
            </div>

            {/* Call Link */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm group cursor-pointer hover:border-primary transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                    <PhoneCall size={12} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Recent Call</span>
                </div>
                <ChevronRight size={12} className="text-slate-300 group-hover:text-primary transition-all" />
              </div>
              <p className="text-xs font-bold text-slate-700">Inbound: 4m 12s</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Today, 10:15 AM</p>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-primary/5 rounded-2xl border border-primary/10 p-5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="text-primary" size={14} />
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary/70">AI Sentiment</h4>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium italic">
              "Patient seems slightly frustrated about scheduling conflicts. Recommending priority slotting."
            </p>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 hover:border-primary transition-all group">
              <div className="flex items-center gap-3">
                <Tag size={16} className="text-slate-400 group-hover:text-primary" />
                <span className="text-xs font-bold text-slate-600">Add Tag</span>
              </div>
              <Plus size={14} className="text-slate-300" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 hover:border-primary transition-all group">
              <div className="flex items-center gap-3">
                <Archive size={16} className="text-slate-400 group-hover:text-primary" />
                <span className="text-xs font-bold text-slate-600">Archive Thread</span>
              </div>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
