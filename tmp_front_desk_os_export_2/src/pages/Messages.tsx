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
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Messages: React.FC = () => {
  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Conversations List */}
      <aside className="w-80 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-slate-900">Messages</h1>
            <button className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm hover:bg-primary/90 transition-all">
              <Plus size={18} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search chats..." 
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {[
            { name: 'John Doe', lastMsg: 'I will be there at 2 PM.', time: '10:30 AM', unread: 2, online: true },
            { name: 'Sarah Smith', lastMsg: 'Can we reschedule?', time: '9:45 AM', unread: 0, online: false },
            { name: 'Tech Corp', lastMsg: 'The contract is ready.', time: 'Yesterday', unread: 0, online: true },
            { name: 'Mike Jones', lastMsg: 'Thanks for the help!', time: 'Yesterday', unread: 0, online: false },
            { name: 'Alice Cooper', lastMsg: 'See you then.', time: 'Mar 14', unread: 0, online: false },
            { name: 'David Miller', lastMsg: 'Sent the documents.', time: 'Mar 14', unread: 0, online: true },
          ].map((chat, i) => (
            <div key={i} className={cn(
              "p-4 border-b border-slate-100 flex gap-3 cursor-pointer hover:bg-slate-50 transition-all",
              i === 0 && "bg-primary/5 border-l-4 border-l-primary"
            )}>
              <div className="relative shrink-0">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-primary font-bold">
                  {chat.name.split(' ').map(n => n[0]).join('')}
                </div>
                {chat.online && (
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{chat.name}</h3>
                  <span className="text-[10px] font-medium text-slate-400">{chat.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 truncate">{chat.lastMsg}</p>
                  {chat.unread > 0 && (
                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat Window */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
        {/* Chat Header */}
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">JD</div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">John Doe</h2>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary transition-all"><Phone size={20} /></button>
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary transition-all"><Video size={20} /></button>
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary transition-all"><Info size={20} /></button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex justify-center">
            <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Today</span>
          </div>

          <div className="flex gap-3 max-w-[70%]">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">JD</div>
            <div className="space-y-1">
              <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
                <p className="text-sm text-slate-700">Hi, I'm interested in booking a dental consult next week. Do you have any openings on Tuesday?</p>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">10:25 AM</span>
            </div>
          </div>

          <div className="flex flex-row-reverse gap-3 max-w-[70%] ml-auto">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px] shrink-0">ME</div>
            <div className="space-y-1 flex flex-col items-end">
              <div className="bg-primary p-3 rounded-2xl rounded-tr-none shadow-md shadow-primary/10">
                <p className="text-sm text-white">Hello John! Yes, we have a few slots available on Tuesday. Would 2:00 PM or 4:30 PM work better for you?</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-medium">10:28 AM</span>
                <CheckCheck size={12} className="text-primary" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 max-w-[70%]">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">JD</div>
            <div className="space-y-1">
              <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
                <p className="text-sm text-slate-700">2:00 PM works great! I will be there at 2 PM.</p>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">10:30 AM</span>
            </div>
          </div>
        </div>

        {/* Chat Input */}
        <div className="p-6 bg-white border-t border-slate-200 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-1 flex items-center gap-2">
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 transition-all"><Smile size={20} /></button>
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 transition-all"><Paperclip size={20} /></button>
            <input 
              type="text" 
              placeholder="Write a message..." 
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
            />
            <button className="h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 hover:bg-primary/90 transition-all">
              <Send size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
