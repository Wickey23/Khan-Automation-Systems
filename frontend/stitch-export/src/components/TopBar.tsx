import React from 'react';
import { Search, Bell, HelpCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export function TopBar() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageTitle = pathParts[pathParts.length - 1] || 'Dashboard';

  return (
    <header className="fixed top-0 right-0 left-64 z-40 bg-white/80 backdrop-blur-md border-b border-outline-variant/10 flex justify-between items-center px-8 h-16">
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          <div className="flex flex-col">
            <span className="hover:text-primary transition-colors cursor-pointer leading-none">Front Desk OS</span>
            <span className="text-[8px] font-bold text-outline uppercase tracking-widest mt-0.5 opacity-60">by Khan Systems</span>
          </div>
          <span className="text-outline-variant mx-2">/</span>
          <span className="text-on-surface capitalize">{pageTitle}</span>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={18} />
          <input 
            type="text" 
            placeholder={`Search ${pageTitle.toLowerCase()}...`}
            className="bg-surface-container-low border-none rounded-xl pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
          </button>
          <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
            <HelpCircle size={20} />
          </button>
        </div>

        <button className="bg-primary text-on-primary px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          New Action
        </button>
      </div>
    </header>
  );
}
