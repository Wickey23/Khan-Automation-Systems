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
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background-light">
        {/* Toolbar */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8 shrink-0">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-slate-900">Appointments</h1>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button className="px-4 py-1.5 text-sm font-bold rounded-md bg-white shadow-sm text-primary">Queue</button>
              <button className="px-4 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">Calendar</button>
              <button className="px-4 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">History</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search bookings..." 
                className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 flex items-center gap-2">
              <Plus size={18} />
              New Booking
            </button>
          </div>
        </div>

        {/* Booking Queue */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Booking Queue</h2>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">12 REQUESTS</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all"><Filter size={18} /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {[
              { name: 'Alice Cooper', type: 'Dental Consult', provider: 'Dr. Aris', time: 'Tomorrow, 2:00 PM', status: 'Pending Confirmation', urgency: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50' },
              { name: 'Bob Wilson', type: 'Routine Cleaning', provider: 'Dr. Sarah', time: 'Mar 18, 10:00 AM', status: 'Action Required', urgency: 'High', color: 'text-red-600', bg: 'bg-red-50' },
              { name: 'Charlie Brown', type: 'Follow-up', provider: 'Dr. Aris', time: 'Mar 19, 4:30 PM', status: 'Pending Confirmation', urgency: 'Low', color: 'text-slate-600', bg: 'bg-slate-50' },
              { name: 'Diana Prince', type: 'Emergency', provider: 'Dr. Sarah', time: 'Today, 5:00 PM', status: 'Urgent', urgency: 'Critical', color: 'text-red-600', bg: 'bg-red-100' },
            ].map((booking, i) => (
              <div key={i} className="group bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-primary/30 transition-all cursor-pointer flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-primary font-bold">
                    {booking.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{booking.name}</h3>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", booking.bg, booking.color)}>
                        {booking.urgency}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><Calendar size={14} /> {booking.time}</span>
                      <span className="flex items-center gap-1"><User size={14} /> {booking.provider}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                    <p className={cn("text-xs font-bold", booking.color)}>{booking.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all"><CheckCircle2 size={18} /></button>
                    <button className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"><XCircle size={18} /></button>
                    <button className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30 transition-all"><ChevronRight size={18} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Center Sidebar */}
      <aside className="w-96 border-l border-slate-200 bg-white flex flex-col flex-shrink-0 overflow-hidden">
        <div className="p-8 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Action Center</h2>
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Clock size={20} /></div>
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-wider">Next Appointment</p>
                <p className="text-sm font-semibold text-slate-900">In 15 minutes</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Patient</span>
                <span className="font-bold text-slate-900">Diana Prince</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Type</span>
                <span className="font-bold text-slate-900">Emergency</span>
              </div>
              <button className="w-full mt-2 rounded-lg bg-primary py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition-all">
                Check-in Patient
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-primary/30 transition-all group">
                <Calendar className="text-slate-400 group-hover:text-primary" size={20} />
                <span className="text-[10px] font-bold text-slate-600">Full Calendar</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-primary/30 transition-all group">
                <FileText className="text-slate-400 group-hover:text-primary" size={20} />
                <span className="text-[10px] font-bold text-slate-600">Daily Report</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Availability Alerts</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900">Double Booking Detected</p>
                  <p className="text-[10px] text-amber-700 mt-0.5">Dr. Aris has two appointments at 2:00 PM tomorrow.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <Clock size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-blue-900">Gap in Schedule</p>
                  <p className="text-[10px] text-blue-700 mt-0.5">There is a 2-hour gap in Dr. Sarah's schedule today.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-slate-200">
          <button className="w-full flex items-center justify-between text-sm font-bold text-slate-600 hover:text-primary transition-all">
            <span>Manage All Providers</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </aside>
    </div>
  );
};
