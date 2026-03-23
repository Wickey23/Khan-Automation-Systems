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
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Appointments: React.FC = () => {
  const [selectedBooking, setSelectedBooking] = React.useState(0);

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

  const currentBooking = bookings[selectedBooking];

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-slate-900">Booking Queue</h1>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button className="px-3 py-1 text-xs font-bold rounded-md bg-white shadow-sm text-primary">Active Requests (12)</button>
              <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700">Resolved</button>
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
              {bookings.map((booking, i) => (
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
              <button className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:text-primary hover:border-primary transition-all shadow-sm bg-white"><Calendar size={18} /></button>
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
                Confirm Booking
              </button>
              <button className="w-full rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                <ArrowRight size={16} />
                Request New Time
              </button>
              <button className="w-full rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                <XCircle size={16} />
                Decline Request
              </button>
            </div>
          </div>
        </div>
      </aside>
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
