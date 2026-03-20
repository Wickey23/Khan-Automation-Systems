import React, { useState } from 'react';
import { 
  Search, 
  MoreVertical, 
  Send, 
  Paperclip, 
  Smile, 
  Phone, 
  Info,
  Check,
  CheckCheck,
  Sparkles,
  User
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const threads = [
  { id: 1, name: 'John Smith', lastMsg: 'Sounds good, see you then!', time: '2m ago', unread: 0, active: true },
  { id: 2, name: 'Sarah Jones', lastMsg: 'Can we reschedule for Friday?', time: '1h ago', unread: 2, active: false },
  { id: 3, name: 'Mike Doe', lastMsg: 'Thanks for the info.', time: 'Yesterday', unread: 0, active: false },
  { id: 4, name: 'Unknown (+1 555 0192)', lastMsg: 'I have a question about my bill.', time: 'Oct 23', unread: 0, active: false },
];

const messages = [
  { id: 1, sender: 'them', text: 'Hi, I was looking for a quote on system migration.', time: '10:30 AM' },
  { id: 2, sender: 'me', text: 'Hello! I can certainly help with that. Are you looking to migrate from an existing legacy system?', time: '10:31 AM', status: 'read' },
  { id: 3, sender: 'them', text: 'Yes, we currently use a local server setup and want to move to the cloud.', time: '10:32 AM' },
  { id: 4, sender: 'me', text: 'That is a great move for scalability. I have some availability next Tuesday for a consultation. Would 10:00 AM work for you?', time: '10:35 AM', status: 'read' },
  { id: 5, sender: 'them', text: 'Sounds good, see you then!', time: '10:40 AM' },
];

export default function MessagesPage() {
  const [msg, setMsg] = useState('');

  return (
    <div className="h-[calc(100vh-160px)] flex bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-outline-variant/10 flex flex-col">
        <div className="p-4 border-b border-outline-variant/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={16} />
            <input 
              type="text" 
              placeholder="Search messages..."
              className="bg-surface-container-low border-none rounded-xl pl-9 pr-4 py-2 text-sm w-full focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {threads.map((thread) => (
            <div 
              key={thread.id} 
              className={cn(
                "p-4 flex items-center gap-3 cursor-pointer transition-colors border-b border-outline-variant/5",
                thread.active ? "bg-primary/5" : "hover:bg-surface-container-low"
              )}
            >
              <div className="w-11 h-11 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant shrink-0">
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <h4 className="text-sm font-bold text-on-surface truncate">{thread.name}</h4>
                  <span className="text-[10px] text-on-surface-variant">{thread.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-on-surface-variant truncate pr-2">{thread.lastMsg}</p>
                  {thread.unread > 0 && (
                    <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">{thread.unread}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Header */}
        <div className="px-6 h-16 border-b border-outline-variant/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">John Smith</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              <Phone size={18} />
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              <Info size={18} />
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-container-low/20 no-scrollbar">
          <div className="flex justify-center">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container-high px-3 py-1 rounded-full">Today</span>
          </div>
          
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.sender === 'me' ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[70%] p-4 rounded-2xl text-sm shadow-sm",
                m.sender === 'me' 
                  ? "bg-primary text-on-primary rounded-tr-none" 
                  : "bg-white text-on-surface rounded-tl-none border border-outline-variant/10"
              )}>
                <p className="leading-relaxed">{m.text}</p>
                <div className={cn(
                  "flex items-center gap-1 mt-2 text-[10px]",
                  m.sender === 'me' ? "text-on-primary/70 justify-end" : "text-on-surface-variant"
                )}>
                  <span>{m.time}</span>
                  {m.sender === 'me' && (
                    m.status === 'read' ? <CheckCheck size={12} /> : <Check size={12} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <div className="p-6 border-t border-outline-variant/10 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">AI Suggestions</span>
          </div>
          <div className="flex gap-2 mb-2">
            {['Confirm Appointment', 'Send Pricing PDF', 'Ask for Location'].map((s) => (
              <button key={s} className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container px-3 py-1.5 rounded-lg transition-colors border border-outline-variant/10">
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              <Paperclip size={20} />
            </button>
            <div className="flex-1 relative">
              <input 
                type="text" 
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Type your message..."
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                <Smile size={20} />
              </button>
            </div>
            <button className="p-3 primary-gradient text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
