import React from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  MoreVertical,
  Filter,
  Search,
  Plus
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const metrics = [
  { label: 'Total Scheduled', value: '124', icon: Calendar, color: 'primary' },
  { label: 'Pending Review', value: '8', icon: AlertCircle, color: 'error' },
  { label: 'Completed', value: '86', icon: CheckCircle2, color: 'secondary' },
  { label: 'New This Week', value: '+12', icon: Users, color: 'tertiary' },
];

const conflicts = [
  { id: 1, client: 'Sarah Henderson', time: 'Oct 24, 10:30 AM', issue: 'Potential Double Booking', detail: 'AI flagged overlap with "System Maintenance" block.' },
  { id: 2, client: 'Mike Ross', time: 'Oct 25, 02:15 PM', issue: 'Out of Office Conflict', detail: 'Technician "Dave" is marked OOO during this window.' },
];

const appointments = [
  { id: 1, client: 'John Smith', service: 'Initial Consultation', time: 'Oct 24, 09:00 AM', status: 'confirmed', tech: 'Dave' },
  { id: 2, client: 'Emily Blunt', service: 'System Migration', time: 'Oct 24, 11:30 AM', status: 'pending', tech: 'Sarah' },
  { id: 3, client: 'Robert Downey', service: 'Maintenance', time: 'Oct 25, 08:00 AM', status: 'confirmed', tech: 'Dave' },
  { id: 4, client: 'Chris Evans', service: 'Repair', time: 'Oct 25, 01:00 PM', status: 'cancelled', tech: 'Sarah' },
];

export default function AppointmentsPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Appointments</h1>
          <p className="text-on-surface-variant text-sm">Manage your schedule and resolve AI-flagged conflicts.</p>
        </div>
        <button className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
          <Plus size={18} /> Create Appointment
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface-container-lowest p-5 rounded-xl card-shadow">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl",
                metric.color === 'primary' && "bg-primary-container/30 text-primary",
                metric.color === 'error' && "bg-error-container/20 text-error",
                metric.color === 'secondary' && "bg-secondary-container/30 text-secondary",
                metric.color === 'tertiary' && "bg-tertiary-container/40 text-tertiary",
              )}>
                <metric.icon size={20} />
              </div>
              <div>
                <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{metric.label}</p>
                <h3 className="text-2xl font-bold">{metric.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-on-surface">Needs Review</h2>
            <span className="text-[10px] font-bold bg-error/10 text-error px-2 py-1 rounded">8 ISSUES</span>
          </div>
          
          <div className="space-y-4">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="bg-white border border-outline-variant/10 p-5 rounded-xl shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-error/5 flex items-center justify-center text-error shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-on-surface truncate">{conflict.client}</h4>
                      <span className="text-[10px] text-on-surface-variant font-medium">{conflict.time}</span>
                    </div>
                    <div className="text-xs font-bold text-error mb-1">{conflict.issue}</div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">{conflict.detail}</p>
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 py-2 rounded-lg bg-surface-container-low text-[11px] font-bold text-on-surface hover:bg-surface-container transition-colors">Reschedule</button>
                      <button className="flex-1 py-2 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary-dim transition-colors">Resolve</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button className="w-full py-3 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors">View All Conflicts</button>
          </div>
        </section>

        <section className="lg:col-span-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
          <div className="p-6 border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-on-surface">Appointment Ledger</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
                <input 
                  type="text" 
                  placeholder="Search ledger..."
                  className="bg-surface-container-low border-none rounded-lg pl-9 pr-4 py-1.5 text-xs w-48 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <button className="p-2 bg-surface-container-low text-on-surface-variant rounded-lg hover:bg-surface-container transition-colors">
                <Filter size={16} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/30">
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Client</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Service</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Time</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Technician</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                  <th className="py-4 px-6 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-surface-container-low/30 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="text-sm font-bold text-on-surface">{apt.client}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs text-on-surface-variant font-medium">{apt.service}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs text-on-surface font-semibold">{apt.time}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
                          {apt.tech[0]}
                        </div>
                        <span className="text-xs text-on-surface-variant font-medium">{apt.tech}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                        apt.status === 'confirmed' && "bg-secondary-container text-on-secondary-container",
                        apt.status === 'pending' && "bg-primary-container text-on-primary-container",
                        apt.status === 'cancelled' && "bg-error/10 text-error",
                      )}>
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="p-1 text-on-surface-variant hover:text-on-surface transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-outline-variant/10 flex justify-center">
            <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View Full Calendar <ChevronRight size={14} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
