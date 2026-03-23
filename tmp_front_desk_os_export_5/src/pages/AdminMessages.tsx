import React from 'react';
import { 
  MessageSquare, 
  Search, 
  Filter, 
  MoreVertical, 
  Shield,
  Building2,
  Clock,
  ExternalLink,
  Send,
  User,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminMessages: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Global Control Plane</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Global Message Logs</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Messages (24h)</span>
            <span className="text-lg font-black text-white">12,482</span>
          </div>
          <button className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all border border-slate-700">
            Audit Export
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
              placeholder="Search by Message ID, Org, or Content..." 
              className="w-96 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button className="px-4 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-primary">All SMS</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">AI Generated</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Operator Sent</button>
          </div>
        </div>
        <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all">
          <Filter size={20} />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-6 py-4">Message Context</th>
                <th className="px-6 py-4">Sender / Recipient</th>
                <th className="px-6 py-4">Content Preview</th>
                <th className="px-6 py-4">Source / Provider</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { id: 'msg_102', org: 'Acme Dental', from: 'AI Assistant', to: '+1 (555) 123-4567', content: 'Your appointment is confirmed for tomorrow at 2 PM.', time: '2 mins ago', source: 'AI', provider: 'Twilio-SMS', color: 'text-primary' },
                { id: 'msg_101', org: 'Global RE', from: 'Operator (Sarah)', to: '+1 (555) 987-6543', content: 'I have sent the listing details to your email.', time: '12 mins ago', source: 'Operator', provider: 'Twilio-SMS', color: 'text-emerald-500' },
                { id: 'msg_100', org: 'Tech Sol', from: 'AI Assistant', to: '+1 (555) 000-1111', content: 'Our support team will contact you shortly.', time: '45 mins ago', source: 'AI', provider: 'Twilio-SMS', color: 'text-primary' },
                { id: 'msg_099', org: 'Acme Dental', from: 'John Doe', to: 'AI Assistant', content: 'Can I reschedule my appointment?', time: '1 hour ago', source: 'Inbound', provider: 'Twilio-SMS', color: 'text-slate-500' },
                { id: 'msg_098', org: 'Health First', from: 'AI Assistant', to: '+1 (555) 444-5555', content: 'Please provide your insurance details.', time: '2 hours ago', source: 'AI', provider: 'Twilio-SMS', color: 'text-primary' },
                { id: 'msg_097', org: 'Quick Fix', from: 'Operator (Mike)', to: '+1 (555) 666-7777', content: 'Your car is ready for pickup.', time: '3 hours ago', source: 'Operator', provider: 'Twilio-SMS', color: 'text-emerald-500' },
              ].map((msg, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{msg.id}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 size={10} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{msg.org}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">From: {msg.from}</span>
                      <span className="text-[9px] font-medium text-slate-400 mt-0.5">To: {msg.to}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <p className="text-xs text-slate-600 truncate max-w-xs italic">"{msg.content}"</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock size={10} className="text-slate-400" />
                      <span className="text-[9px] font-medium text-slate-400">{msg.time}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        {msg.source === 'AI' ? <Bot size={12} className="text-primary" /> : <User size={12} className="text-slate-400" />}
                        <span className={cn("text-[9px] font-bold uppercase tracking-widest", msg.color)}>
                          {msg.source}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 mt-0.5">{msg.provider}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
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
