import React from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  UserPlus, 
  Download, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  User,
  ExternalLink,
  Share2,
  Check,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const roles = [
  { 
    id: 'admin', 
    label: 'Admin', 
    icon: ShieldCheck, 
    color: 'primary', 
    count: 3,
    detail: 'Full system access. Includes financial oversight, workspace settings, and user management privileges.' 
  },
  { 
    id: 'member', 
    label: 'Member', 
    icon: User, 
    color: 'secondary', 
    count: 12,
    detail: 'Operational access. Focused on project execution, inventory updates, and report viewing.' 
  },
];

const team = [
  { id: 1, name: 'Sarah Johnson', email: 'sarah.j@khansystems.com', role: 'Admin', status: 'active', mfa: true, lastLogin: '2 hours ago', avatar: 'https://picsum.photos/seed/sarah/100/100' },
  { id: 2, name: 'Marcus Chen', email: 'm.chen@khansystems.com', role: 'Member', status: 'active', mfa: true, lastLogin: '4 hours ago', avatar: 'https://picsum.photos/seed/marcus/100/100' },
  { id: 3, name: 'Linda V.', email: 'linda.v@external.com', role: 'Member', status: 'pending', mfa: false, lastLogin: 'Invited Yesterday', avatar: null },
  { id: 4, name: 'James Wilson', email: 'j.wilson@khansystems.com', role: 'Member', status: 'active', mfa: false, lastLogin: '12 mins ago', avatar: 'https://picsum.photos/seed/james/100/100' },
];

export default function TeamPage() {
  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Team</h1>
          <p className="text-on-surface-variant max-w-xl text-sm mt-2">Manage workspace access, roles, and security settings. Orchestrate your team's operational efficiency from a central hub.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-5 py-2.5 rounded-lg border border-outline-variant text-on-surface font-semibold text-sm hover:bg-surface-container-low transition-colors flex items-center gap-2">
            <Download size={18} /> Export List
          </button>
          <button className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2">
            <UserPlus size={18} /> Invite Member
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-transparent hover:border-outline-variant/20 transition-all flex flex-col justify-between group">
            <div>
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors",
                role.color === 'primary' ? "bg-primary-container/30 text-primary" : "bg-secondary-container/30 text-secondary"
              )}>
                <role.icon size={20} />
              </div>
              <h3 className="text-lg font-bold mb-1">{role.label}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">{role.detail}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-surface-container-high flex items-center justify-between text-xs font-medium">
              <span className="text-on-surface-variant">Active {role.label}s</span>
              <span className="px-2 py-0.5 bg-surface-container-high rounded text-on-surface">{role.count}</span>
            </div>
          </div>
        ))}
        
        <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg flex flex-col justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center mb-4">
              <Shield size={20} />
            </div>
            <h3 className="text-lg font-bold mb-1">Security Health</h3>
            <p className="text-xs text-slate-400 leading-relaxed">88% of your team has Multi-Factor Authentication (2FA) enabled. Recommend enforcement for all.</p>
          </div>
          <div className="relative z-10 mt-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 w-[88%] rounded-full"></div>
            </div>
            <span className="text-[10px] font-bold tracking-tighter">88%</span>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant/10">
        <div className="px-8 py-6 flex items-center justify-between border-b border-surface-container">
          <h3 className="font-bold text-lg">Team Members</h3>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-surface-container rounded-lg transition-colors">
              <Filter size={20} className="text-on-surface-variant" />
            </button>
            <span className="text-xs text-on-surface-variant font-medium">Showing {team.length} Results</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              <tr>
                <th className="px-8 py-4">Member</th>
                <th className="px-8 py-4">Role</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 text-center">Security</th>
                <th className="px-8 py-4">Last Login</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {team.map((member) => (
                <tr key={member.id} className={cn(
                  "group hover:bg-surface-container-low transition-colors",
                  member.status === 'pending' && "bg-surface-container-low/30"
                )}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant border border-dashed border-outline-variant">
                          <User size={20} />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className={cn("font-bold text-on-surface", member.status === 'pending' && "italic")}>
                          {member.status === 'pending' ? 'Awaiting Acceptance' : member.name}
                        </span>
                        <span className="text-xs text-on-surface-variant">{member.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight",
                      member.role === 'Admin' ? "bg-primary-container text-on-primary-container" : "bg-secondary-container text-on-secondary-container"
                    )}>{member.role}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-1.5 text-xs text-on-surface">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        member.status === 'active' ? "bg-emerald-500" : "bg-slate-400 animate-pulse"
                      )}></span>
                      {member.status === 'active' ? 'Active' : 'Pending Invitation'}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    {member.mfa ? (
                      <ShieldCheck size={20} className="text-emerald-500 mx-auto" />
                    ) : (
                      <AlertTriangle size={20} className="text-error mx-auto" />
                    )}
                  </td>
                  <td className="px-8 py-5 text-on-surface-variant text-xs">
                    {member.lastLogin}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {member.status === 'pending' ? (
                        <button className="px-3 py-1 bg-surface-container-highest text-on-surface text-[10px] font-bold rounded hover:bg-primary hover:text-white transition-all uppercase tracking-wider">
                          Resend
                        </button>
                      ) : (
                        <button className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-on-surface-variant">
                          <Edit size={18} />
                        </button>
                      )}
                      <button className="p-1.5 hover:bg-error-container/20 rounded transition-colors text-error">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-8 py-6 border-t border-surface-container flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">Page 1 of 3</span>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded border border-outline-variant disabled:opacity-30" disabled>
                <ChevronLeft size={18} />
              </button>
              <button className="p-1 rounded border border-outline-variant hover:bg-surface-container">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-24 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-surface-container flex items-center justify-center rounded-2xl mx-auto mb-6 text-on-surface-variant">
          <User size={32} />
        </div>
        <h4 className="text-xl font-bold mb-2">Build your operational core</h4>
        <p className="text-on-surface-variant text-sm mb-8">Add specialized personnel to help manage your global operations. You can control exactly what each member can see and do.</p>
        <button className="text-primary font-bold text-sm hover:underline flex items-center gap-2 mx-auto">
          Learn more about access roles
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}
