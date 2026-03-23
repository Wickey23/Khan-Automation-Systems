import React from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MoreVertical, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Search,
  Filter,
  Plus,
  ArrowRight,
  MapPin,
  FileText,
  MessageSquare,
  Sparkles,
  Inbox,
  UserPlus,
  History,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Appointments: React.FC = () => {
  const [selectedBooking, setSelectedBooking] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState('Needs Review');

  const bookings = [
    { 
      id: 0,
      name: 'Alice Cooper', 
      type: 'Dental Consult', 
      provider: 'Dr. Aris', 
      time: 'Tomorrow, 2:00 PM', 
      status: 'Needs Review', 
      urgency: 'Medium', 
      source: 'AI Call',
      notes: 'Patient requested a consultation for implants. AI flagged as potential high-value lead.',
      color: 'text-amber-600', 
      bg: 'bg-amber-50' 
    },
    { 
      id: 1,
      name: 'Bob Wilson', 
      type: 'Routine Cleaning', 
      provider: 'Dr. Sarah', 
      time: 'Mar 18, 10:00 AM', 
      status: 'Ready to Book', 
      urgency: 'High', 
      source: 'SMS Bot',
      notes: 'Insurance verified. Patient is ready to be slotted into the schedule.',
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50' 
    },
    { 
      id: 2,
      name: 'Charlie Brown', 
      type: 'Follow-up', 
      provider: 'Dr. Aris', 
      time: 'Mar 19, 4:30 PM', 
      status: 'Awaiting Reply', 
      urgency: 'Low', 
      source: 'Web Form',
      notes: 'Sent available slots via SMS. Waiting for patient to pick one.',
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      id: 3,
      name: 'Diana Prince', 
      type: 'Emergency', 
      provider: 'Dr. Sarah', 
      time: 'Today, 5:00 PM', 
      status: 'Booked', 
      urgency: 'Critical', 
      source: 'Direct Call',
      notes: 'Emergency tooth pain. Slot confirmed and patient notified.',
      color: 'text-slate-600', 
      bg: 'bg-slate-50' 
    },
    { 
      id: 4,
      name: 'Edward Norton', 
      type: 'Whitening', 
      provider: 'Dr. Aris', 
      time: 'Mar 22, 11:00 AM', 
      status: 'Resolved', 
      urgency: 'Low', 
      source: 'AI Call',
      notes: 'Appointment completed and follow-up scheduled.',
      color: 'text-slate-400', 
      bg: 'bg-slate-50' 
    },
  ];

  const filteredBookings = bookings.filter(b => b.status === activeTab || activeTab === 'All');
  const currentBooking = filteredBookings[selectedBooking] || bookings[0];

  const tabs = ['Needs Review', 'Ready to Book', 'Awaiting Reply', 'Booked', 'Resolved'];

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-slate-200">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Inbox size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Booking Triage</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Front-Desk Request Queue</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search requests..." 
                className="h-9 w-64 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-xs focus:border-primary outline-none transition-all"
              />
            </div>
            <button className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
              <Plus size={16} />
              New Request
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="h-12 border-b border-slate-200 bg-slate-50/50 px-8 flex items-center gap-6 shrink-0">
          {tabs.map(tab => (
            <button 
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSelectedBooking(0);
              }}
              className={cn(
                "h-full px-1 relative text-[11px] font-bold uppercase tracking-wider transition-all",
                activeTab === tab ? "text-primary" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-8 py-3">Patient / Source</th>
                <th className="px-8 py-3">Service</th>
                <th className="px-8 py-3">Requested Time</th>
                <th className="px-8 py-3">Urgency</th>
                <th className="px-8 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBookings.map((booking, i) => (
                <tr 
                  key={i} 
                  onClick={() => setSelectedBooking(i)}
                  className={cn(
                    "group hover:bg-slate-50 cursor-pointer transition-colors",
                    selectedBooking === i && "bg-primary/5"
                  )}
                >
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-xs shadow-sm",
                        selectedBooking === i ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {booking.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{booking.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{booking.source}</span>
                          <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{booking.provider}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        <FileText size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{booking.type}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
                      <Clock size={14} className="text-slate-400" />
                      {booking.time}
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest",
                      booking.bg, booking.color
                    )}>
                      <AlertCircle size={10} />
                      {booking.urgency}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-white shadow-sm transition-all border border-transparent hover:border-slate-200">
                        <MessageSquare size={16} />
                      </button>
                      <button className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-white shadow-sm transition-all border border-transparent hover:border-slate-200">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Center Sidebar */}
      <aside className="w-[400px] bg-slate-50/50 flex flex-col shrink-0 overflow-hidden">
        <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Action Center</h2>
          <div className="flex gap-2">
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><History size={18} /></button>
            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-all"><MoreVertical size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Patient Profile Quick View */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-2xl shadow-inner">
                {currentBooking.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                  currentBooking.status === 'Needs Review' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {currentBooking.status}
                </span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">ID: #BK-9428</p>
              </div>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{currentBooking.name}</h3>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                <Phone size={12} />
                +1 (555) 000-0000
              </div>
              <div className="h-1 w-1 rounded-full bg-slate-300"></div>
              <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                <MapPin size={12} />
                New York, NY
              </div>
            </div>
          </div>

          {/* AI Context & Triage Notes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="text-primary" size={16} />
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">AI Triage Context</h4>
            </div>
            <div className="bg-primary/5 rounded-2xl border border-primary/10 p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <Sparkles size={48} />
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium italic relative z-10">
                "{currentBooking.notes}"
              </p>
            </div>
          </div>

          {/* Operator Workflow Actions */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 px-1">Operator Actions</h4>
            <div className="grid grid-cols-1 gap-3">
              <button className="w-full rounded-2xl bg-primary py-4 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 uppercase tracking-widest">
                <CheckCircle2 size={18} />
                Approve & Schedule
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button className="rounded-2xl border border-slate-200 bg-white py-3.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                  <Calendar size={16} />
                  Reschedule
                </button>
                <button className="rounded-2xl border border-slate-200 bg-white py-3.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                  <MessageSquare size={16} />
                  Send SMS
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button className="rounded-2xl border border-slate-200 bg-white py-3.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                  <UserPlus size={16} />
                  Merge Record
                </button>
                <button className="rounded-2xl border border-slate-200 bg-white py-3.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                  <XCircle size={16} />
                  Reject
                </button>
              </div>

              <button className="w-full rounded-2xl border border-slate-900 bg-slate-900 py-3.5 text-[10px] font-bold text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                <ExternalLink size={16} />
                Finalize & Close Request
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

