import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  BarChart3, 
  Settings, 
  Plus, 
  Search, 
  Bell, 
  MessageSquare,
  ConciergeBell,
  PhoneCall,
  Rocket,
  CreditCard,
  Shield,
  Activity,
  Terminal,
  Monitor,
  FlaskConical,
  History
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isAdmin = false }) => {
  const location = useLocation();
  
  const navItems = isAdmin ? [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Building2, label: 'Organizations', path: '/admin/orgs' },
    { icon: PhoneCall, label: 'Calls', path: '/admin/calls' },
    { icon: MessageSquare, label: 'Messages', path: '/admin/messages' },
    { icon: Users, label: 'Leads', path: '/admin/leads' },
    { icon: Activity, label: 'System Health', path: '/admin/system' },
    { icon: History, label: 'Events', path: '/admin/events' },
    { icon: BarChart3, label: 'Reports', path: '/admin/reports' },
    { icon: Monitor, label: 'Demo Sandbox', path: '/admin/demo' },
  ] : [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/app' },
    { icon: PhoneCall, label: 'Calls', path: '/app/calls' },
    { icon: Users, label: 'Leads', path: '/app/leads' },
    { icon: Calendar, label: 'Appointments', path: '/app/appointments' },
    { icon: MessageSquare, label: 'Messages', path: '/app/messages' },
    { icon: Rocket, label: 'Outreach', path: '/app/outreach' },
    { icon: Users, label: 'Team', path: '/app/team' },
    { icon: CreditCard, label: 'Billing', path: '/app/billing' },
    { icon: Settings, label: 'Settings', path: '/app/settings' },
  ];

  return (
    <aside className={cn(
      "w-64 flex-shrink-0 border-r flex flex-col justify-between h-screen sticky top-0 transition-colors duration-300",
      isAdmin ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    )}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3 px-2">
          <div className={cn(
            "rounded-xl p-2 flex items-center justify-center text-white shadow-lg",
            isAdmin ? "bg-primary shadow-primary/20" : "bg-primary shadow-primary/20"
          )}>
            {isAdmin ? <Shield size={24} /> : <ConciergeBell size={24} />}
          </div>
          <div className="flex flex-col">
            <h1 className={cn(
              "text-base font-extrabold leading-none tracking-tight",
              isAdmin ? "text-white" : "text-slate-900"
            )}>Front Desk OS</h1>
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-widest mt-1",
              isAdmin ? "text-primary" : "text-slate-500"
            )}>{isAdmin ? 'Admin Console' : 'Reception Manager'}</p>
          </div>
        </div>
        
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/app' && item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group",
                  isActive 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : isAdmin 
                      ? "text-slate-400 hover:text-white hover:bg-slate-800" 
                      : "text-slate-600 hover:text-primary hover:bg-primary/5"
                )}
              >
                <item.icon size={20} className={cn(
                  "transition-colors",
                  isActive ? "text-white" : isAdmin ? "text-slate-500 group-hover:text-white" : "text-slate-400 group-hover:text-primary"
                )} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className={cn(
        "p-6 border-t",
        isAdmin ? "border-slate-800" : "border-slate-200"
      )}>
        <button className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-white text-sm font-bold transition-all shadow-lg",
          isAdmin ? "bg-slate-800 hover:bg-slate-700 shadow-black/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"
        )}>
          <Plus size={18} />
          <span>{isAdmin ? 'System Action' : 'New Booking'}</span>
        </button>
      </div>
    </aside>
  );
};

export const Header: React.FC = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <header className={cn(
      "h-16 flex items-center justify-between border-b px-8 flex-shrink-0 sticky top-0 z-10 transition-colors duration-300",
      isAdmin ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    )}>
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder={isAdmin ? "Search system logs, orgs, or events..." : "Search leads, bookings, or calls..."} 
            className={cn(
              "w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all",
              isAdmin 
                ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-primary" 
                : "bg-slate-100 border-transparent text-slate-900 placeholder-slate-500 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/5"
            )}
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button className={cn(
          "p-2 rounded-lg transition-all relative",
          isAdmin ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100 hover:text-primary"
        )}>
          <Bell size={20} />
          <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></div>
        </button>
        <button className={cn(
          "p-2 rounded-lg transition-all",
          isAdmin ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100 hover:text-primary"
        )}>
          <MessageSquare size={20} />
        </button>
        <div className={cn(
          "h-8 w-px mx-1",
          isAdmin ? "bg-slate-800" : "bg-slate-200"
        )}></div>
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className={cn(
              "text-sm font-bold leading-none",
              isAdmin ? "text-white" : "text-slate-900"
            )}>Alex Rivera</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{isAdmin ? 'Super Admin' : 'Reception Manager'}</p>
          </div>
          <div className={cn(
            "h-10 w-10 rounded-xl border overflow-hidden shadow-sm",
            isAdmin ? "border-slate-700" : "border-slate-200"
          )}>
            <img 
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" 
              alt="Alex Rivera" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

const Building2: React.FC<{ size?: number, className?: string }> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>
    <path d="M10 6h4"></path>
    <path d="M10 10h4"></path>
    <path d="M10 14h4"></path>
    <path d="M10 18h4"></path>
  </svg>
);
