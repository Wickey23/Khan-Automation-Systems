import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutGrid, 
  Zap, 
  Phone, 
  MessageSquare, 
  Calendar, 
  UserPlus, 
  Users, 
  Megaphone, 
  CreditCard, 
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
  Database,
  UserCircle,
  BookOpen,
  Lightbulb,
  Mail
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const navItems = [
  { icon: LayoutGrid, label: 'Dashboard', href: '/app' },
  { icon: Zap, label: 'Activation', href: '/app/activation' },
  { icon: Phone, label: 'Calls', href: '/app/calls' },
  { icon: Database, label: 'Infrastructure', href: '/app/infrastructure' },
  { icon: MessageSquare, label: 'Messages', href: '/app/messages' },
  { icon: Calendar, label: 'Appointments', href: '/app/appointments' },
  { icon: UserPlus, label: 'Leads', href: '/app/leads' },
  { icon: UserCircle, label: 'Team', href: '/app/team' },
  { icon: Users, label: 'Customer Base', href: '/app/customers' },
  { icon: Megaphone, label: 'Outreach', href: '/app/outreach' },
];

const resourceItems = [
  { icon: Lightbulb, label: 'Solutions', href: '/solutions' },
  { icon: BookOpen, label: 'Case Studies', href: '/case-studies' },
  { icon: Mail, label: 'Contact Support', href: '/contact' },
];

const footerNavItems = [
  { icon: CreditCard, label: 'Billing', href: '/app/billing' },
  { icon: Settings, label: 'Settings', href: '/app/settings' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 flex flex-col bg-white border-r border-outline-variant/20 py-6 px-4 z-50">
      <div className="mb-10 px-3 flex items-center gap-3">
        <div className="w-8 h-8 primary-gradient rounded-lg flex items-center justify-center text-white">
          <Sparkles size={18} fill="currentColor" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-extrabold tracking-tight text-on-surface leading-none">Front Desk OS</h1>
          <span className="text-[10px] font-bold text-outline uppercase tracking-widest mt-0.5">by Khan Systems</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium",
              isActive 
                ? "bg-primary/5 text-primary font-semibold" 
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            )}
          >
            <item.icon size={20} className={cn(location.pathname === item.href && "fill-primary/10")} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="pt-4 pb-2 px-3">
          <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Resources</p>
        </div>

        {resourceItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-sm font-medium",
              isActive 
                ? "bg-primary/5 text-primary font-semibold" 
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            )}
          >
            <item.icon size={18} className={cn(location.pathname === item.href && "fill-primary/10")} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-outline-variant/10 space-y-1">
        {footerNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium",
              isActive 
                ? "bg-primary/5 text-primary font-semibold" 
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            )}
          >
            <item.icon size={20} className={cn(location.pathname === item.href && "fill-primary/10")} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="flex items-center gap-3 px-3 py-4 mt-2">
          <div className="w-9 h-9 rounded-xl bg-surface-container-highest flex items-center justify-center overflow-hidden">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDl7o9VJafiT6eVrTUENQ6zXaUb2LLn9_VoV9JlerxOR-JOdxPi1V7xN-vez5Slc7ryHoOBfmkN7l6QVW4AIC-pJY4clyUg4NGkhJUBz-F5HqYXuTXpulb7pP53Fm2d6YxpP3rcCDDL0aquCQSDnoziYwl5La5P9UtdTiEvsDRNY1y9mrmdzIqmzuqucQ8GiDpbZPrIKZdrVum_H21XMd0oAsRQcc6tQ6X3w4K7EnTC4uLGlgUdOFZZqcaLR4xfJe9ySgBELSRiH36f" 
              alt="Alex Thompson"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-on-surface truncate">Alex Thompson</span>
            <span className="text-[10px] text-on-surface-variant truncate">Admin Account</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
