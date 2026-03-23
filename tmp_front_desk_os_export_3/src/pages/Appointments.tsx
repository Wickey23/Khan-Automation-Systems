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
  Sparkles
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
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-slate-900">Booking Queue</h1>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {tabs.map(tab => (
                <button 
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedBooking(0);
                  }}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                    activeTab === tab ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search requests..." 
                className="h-8 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs focus:border-primary outline-none"
              />
            </div>
            <button className="flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white shadow-sm hover:bg-primary/90">
              <Plus size={14} />
              New Request
            </button>
          </div>
        </div>

        {/* Booking Queue List */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Patient</th>
                <th className="px-6 py-3">Service Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Preferred Time</th>
                <th className="px-6 py-3 text-right">Urgency</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.map((booking, i) => (
                <tr 
                  key={i} 
                  onClick={() => setSelectedBooking(i)}
                  className={cn(
                    "group hover:bg-slate-50 cursor-pointer transition-colors",
                    selectedBooking === i && "bg-primary/5"
                  )}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm",
                        selectedBooking === i ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {booking.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{booking.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{booking.provider}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText size={12} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">{booking.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      booking.status === 'Needs Review' ? "bg-amber-100 text-amber-700" :
                      booking.status === 'Ready to Book' ? "bg-emerald-100 text-emerald-700" :
                      booking.status === 'Awaiting Reply' ? "bg-blue-100 text-blue-700" :
                      booking.status === 'Booked' ? "bg-slate-100 text-slate-700" :
                      "bg-slate-50 text-slate-400"
                    )}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold uppercase tracking-tighter">
                      <Clock size={12} />
                      {booking.time}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", booking.bg, booking.color)}>
                      <AlertCircle size={10} />
                      {booking.urgency}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight size={16} className={cn(selectedBooking === i ? "text-primary" : "text-slate-300")} />
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Calendar className="text-slate-200" size={48} />
                      <p className="text-sm font-bold text-slate-400">No requests in this queue</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Center Sidebar */}
      <aside className="w-96 border-l border-slate-200 bg-slate-50/30 flex flex-col flex-shrink-0 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xl shadow-sm">
              {currentBooking.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex gap-2">
              <button className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:text-primary hover:border-primary transition-all shadow-sm bg-white"><Phone size={18} /></button>
              <button className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:text-primary hover:border-primary transition-all shadow-sm bg-white"><MessageSquare size={18} /></button>
              <button className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:text-primary hover:border-primary transition-all shadow-sm bg-white"><MoreVertical size={18} /></button>
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{currentBooking.name}</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{currentBooking.type} • {currentBooking.time}</p>
          
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1", currentBooking.bg, currentBooking.color)}>
              <AlertCircle size={10} /> {currentBooking.urgency} Urgency
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock size={10} /> {currentBooking.status}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Booking Context */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="text-primary" size={16} />
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Booking Context</h4>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
              "{currentBooking.notes}"
            </p>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">Request Details</h3>
            <div className="space-y-4 px-1">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400"><Calendar size={14} /></div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Preferred Time</p>
                  <p className="text-xs font-bold text-slate-900">{currentBooking.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400"><User size={14} /></div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Provider</p>
                  <p className="text-xs font-bold text-slate-900">{currentBooking.provider}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400"><MapPin size={14} /></div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Location</p>
                  <p className="text-xs font-bold text-slate-900">Main Office • Suite 400</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">Operator Actions</h3>
            <div className="space-y-3">
              <button className="w-full rounded-xl bg-primary py-3.5 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                <CheckCircle2 size={16} />
                Approve Booking
              </button>
              <button className="w-full rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                <Calendar size={16} />
                Reschedule
              </button>
              <button className="w-full rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                <MessageSquare size={16} />
                Send SMS
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button className="rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                  Merge
                </button>
                <button className="rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                  Finalize
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
