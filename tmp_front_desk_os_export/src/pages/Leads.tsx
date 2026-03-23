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
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Leads: React.FC = () => {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background-light">
        {/* Toolbar */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search leads by name, phone, or email..." 
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
              <Filter size={18} />
              Filters
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90">
              Add New Lead
            </button>
          </div>
        </div>

        {/* Leads Table */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-4">Lead Information</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Urgency</th>
                  <th className="px-6 py-4">Last Activity</th>
                  <th className="px-6 py-4 text-right">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { name: 'Robert Fox', email: 'robert@example.com', phone: '(555) 012-3456', status: 'Inbound Call', urgency: 'High', time: '12 mins ago', action: 'Call Back Now', color: 'text-red-600', bg: 'bg-red-50' },
                  { name: 'Jane Cooper', email: 'jane@example.com', phone: '(555) 987-6543', status: 'Web Form', urgency: 'Medium', time: '45 mins ago', action: 'Send SMS', color: 'text-amber-600', bg: 'bg-amber-50' },
                  { name: 'Cody Fisher', email: 'cody@example.com', phone: '(555) 231-8890', status: 'Missed Call', urgency: 'High', time: '1 hr ago', action: 'Call Back Now', color: 'text-red-600', bg: 'bg-red-50' },
                  { name: 'Esther Howard', email: 'esther@example.com', phone: '(555) 445-1122', status: 'Referral', urgency: 'Low', time: '3 hrs ago', action: 'Review Lead', color: 'text-slate-600', bg: 'bg-slate-50' },
                  { name: 'Jenny Wilson', email: 'jenny@example.com', phone: '(555) 667-2233', status: 'Inbound Call', urgency: 'Medium', time: '5 hrs ago', action: 'Send SMS', color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((lead, i) => (
                  <tr key={i} className="group hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-primary font-bold text-sm">
                          {lead.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{lead.name}</div>
                          <div className="text-xs text-slate-500">{lead.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-slate-400" />
                        <span className="text-sm text-slate-600">{lead.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", lead.bg, lead.color)}>
                        <AlertCircle size={12} />
                        {lead.urgency}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Clock size={14} />
                        {lead.time}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                        lead.urgency === 'High' ? "bg-primary text-white shadow-sm hover:bg-primary/90" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}>
                        {lead.action}
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lead Detail Sidebar */}
      <aside className="w-96 border-l border-slate-200 bg-white flex flex-col flex-shrink-0 overflow-hidden">
        <div className="p-8 border-b border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-2xl">RF</div>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary hover:border-primary transition-all"><Phone size={20} /></button>
              <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary hover:border-primary transition-all"><MessageSquare size={20} /></button>
              <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary hover:border-primary transition-all"><MoreVertical size={20} /></button>
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">Robert Fox</h2>
          <p className="text-sm text-slate-500 mt-1">Lead created via Google Ads • 12 mins ago</p>
          
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center gap-1">
              <AlertCircle size={12} /> High Urgency
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1">
              <Tag size={12} /> Inbound Call
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Contact Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Phone size={16} /></div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Phone</p>
                  <p className="text-sm font-semibold text-slate-900">(555) 012-3456</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Mail size={16} /></div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Email</p>
                  <p className="text-sm font-semibold text-slate-900">robert@example.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><User size={16} /></div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Assigned To</p>
                  <p className="text-sm font-semibold text-slate-900 underline decoration-primary/30 cursor-pointer">Sarah Operator</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Operator Notes</h3>
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <p className="text-sm text-slate-600 leading-relaxed italic">
                "Caller is looking for a dental implant consultation. They mentioned they have been experiencing pain for 2 weeks and are looking for an urgent appointment. They have BlueCross insurance."
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sarah O. • 10 mins ago</span>
                <button className="text-[10px] font-bold text-primary hover:underline">Edit Notes</button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Primary Action</h3>
            <button className="w-full rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
              <Phone size={18} />
              Call Robert Now
            </button>
            <button className="w-full mt-3 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              <Calendar size={18} />
              Book Appointment
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
