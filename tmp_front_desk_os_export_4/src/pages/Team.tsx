import React from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  MoreVertical, 
  Mail, 
  Shield, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Filter,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Team: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-12 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Team Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your team members, roles, and permissions.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
          <Plus size={20} />
          Invite Member
        </button>
      </header>

      {/* Toolbar */}
      <div className="h-16 bg-white border-b border-slate-200 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search members..." 
              className="w-80 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2"></div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button className="px-4 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-primary">All Members</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Admins</button>
            <button className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Operators</button>
          </div>
        </div>
        <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-primary transition-all">
          <Filter size={20} />
        </button>
      </div>

      {/* Team List */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-8 py-4">Member</th>
                <th className="px-8 py-4">Role</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Last Active</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { name: 'Sameer Kumar', email: 'sameerk0723@gmail.com', role: 'Owner', status: 'Active', lastActive: 'Just now', initial: 'SK', color: 'bg-primary/10 text-primary' },
                { name: 'Alice Cooper', email: 'alice@example.com', role: 'Admin', status: 'Active', lastActive: '2 hours ago', initial: 'AC', color: 'bg-emerald-100 text-emerald-600' },
                { name: 'Bob Wilson', email: 'bob@example.com', role: 'Operator', status: 'Active', lastActive: 'Yesterday', initial: 'BW', color: 'bg-blue-100 text-blue-600' },
                { name: 'Charlie Brown', email: 'charlie@example.com', role: 'Operator', status: 'Pending', lastActive: 'Never', initial: 'CB', color: 'bg-slate-100 text-slate-400' },
                { name: 'Diana Prince', email: 'diana@example.com', role: 'Viewer', status: 'Active', lastActive: '3 days ago', initial: 'DP', color: 'bg-purple-100 text-purple-600' },
              ].map((member, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm", member.color)}>
                        {member.initial}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{member.name}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail size={12} />
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-slate-400" />
                      <span className="text-sm font-bold text-slate-700">{member.role}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      member.status === 'Active' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                    )}>
                      <div className={cn("h-1.5 w-1.5 rounded-full", member.status === 'Active' ? "bg-emerald-500" : "bg-amber-500")}></div>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <Clock size={14} />
                      {member.lastActive}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invite Stats */}
        <div className="mt-12 grid grid-cols-3 gap-8">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Users size={28} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Members</p>
              <p className="text-3xl font-extrabold text-slate-900">12</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Now</p>
              <p className="text-3xl font-extrabold text-slate-900">4</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
              <Clock size={28} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Invites</p>
              <p className="text-3xl font-extrabold text-slate-900">2</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
