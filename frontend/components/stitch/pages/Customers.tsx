"use client";

import React from 'react';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Heart, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight,
  Download,
  Mail,
  Phone,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

const metrics = [
  { label: 'Total Customers', value: '2,842', icon: Users, color: 'primary' },
  { label: 'Active This Month', value: '456', icon: UserCheck, color: 'secondary' },
  { label: 'Retention Rate', value: '94.2%', icon: Heart, color: 'error' },
  { label: 'New Customers', value: '128', icon: UserPlus, color: 'tertiary' },
];

const customers = [
  { id: 1, name: 'John Smith', email: 'john.smith@example.com', phone: '+1 (555) 012-3456', ltv: '$4,250', lastBooking: '2 days ago', status: 'active' },
  { id: 2, name: 'Sarah Jones', email: 'sarah.j@gmail.com', phone: '+1 (555) 014-5522', ltv: '$1,800', lastBooking: '1 week ago', status: 'active' },
  { id: 3, name: 'Mike Doe', email: 'mike.doe@outlook.com', phone: '+1 (555) 011-9988', ltv: '$850', lastBooking: '3 weeks ago', status: 'inactive' },
  { id: 4, name: 'Emily Blunt', email: 'eblunt@media.com', phone: '+1 (555) 018-7766', ltv: '$12,400', lastBooking: 'Just now', status: 'active' },
  { id: 5, name: 'Robert Downey', email: 'rdj@stark.com', phone: '+1 (555) 013-4411', ltv: '$2,100', lastBooking: '1 month ago', status: 'inactive' },
];

export default function CustomersPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Customer Base</h1>
          <p className="text-on-surface-variant text-sm">Comprehensive CRM and customer lifecycle management.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2.5 bg-surface-container-lowest text-on-surface-variant rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-all">
            <Download size={20} />
          </button>
          <button className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            Add Customer
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface-container-lowest p-5 rounded-xl card-shadow">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl",
                metric.color === 'primary' && "bg-primary-container/30 text-primary",
                metric.color === 'secondary' && "bg-secondary-container/30 text-secondary",
                metric.color === 'error' && "bg-error-container/20 text-error",
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

      <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
        <div className="p-6 border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-on-surface">Customer Directory</h2>
            <div className="flex bg-surface-container-low p-1 rounded-lg">
              {['All', 'Active', 'VIP'].map((f) => (
                <button key={f} className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                  f === 'All' ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                )}>{f}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={14} />
              <input 
                type="text" 
                placeholder="Search customers..."
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
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Customer</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Contact Info</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Lifetime Value</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Last Booking</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                <th className="py-4 px-6 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-surface-container-low/30 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-[11px] font-bold text-on-surface-variant">
                        {customer.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="text-sm font-bold text-on-surface">{customer.name}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <Mail size={12} /> {customer.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <Phone size={12} /> {customer.phone}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-xs text-on-surface font-bold">{customer.ltv}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                      <Calendar size={12} /> {customer.lastBooking}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                      customer.status === 'active' ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-highest text-on-surface-variant"
                    )}>
                      {customer.status}
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
        <div className="p-4 border-t border-outline-variant/10 flex justify-between items-center bg-surface-container-low/20">
          <span className="text-xs text-on-surface-variant font-medium">Showing 5 of 2,842 customers</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-xs font-bold text-on-surface-variant bg-white border border-outline-variant/20 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1.5 text-xs font-bold text-on-surface bg-white border border-outline-variant/20 rounded-lg hover:bg-surface-container transition-colors">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}
