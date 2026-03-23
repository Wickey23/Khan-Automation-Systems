import React from 'react';
import { 
  User, 
  Bell, 
  Lock, 
  Globe, 
  Database, 
  CreditCard, 
  Users, 
  Smartphone, 
  ChevronRight, 
  Save,
  Shield,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Settings: React.FC = () => {
  return (
    <div className="flex flex-1 overflow-hidden bg-background-light">
      {/* Settings Navigation */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {[
            { label: 'Profile', icon: User, active: true },
            { label: 'Notifications', icon: Bell, active: false },
            { label: 'Security', icon: Lock, active: false },
            { label: 'Workspace', icon: Globe, active: false },
            { label: 'Integrations', icon: Database, active: false },
            { label: 'Billing', icon: CreditCard, active: false },
            { label: 'Team', icon: Users, active: false },
            { label: 'Appearance', icon: Palette, active: false },
          ].map((item, i) => (
            <button key={i} className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all",
              item.active ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-600 hover:bg-slate-50"
            )}>
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Settings Content */}
      <main className="flex-1 overflow-y-auto p-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">Profile Settings</h2>
              <p className="text-sm text-slate-500 mt-1">Manage your personal information and account preferences.</p>
            </div>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
              <Save size={18} />
              Save Changes
            </button>
          </div>

          <div className="space-y-8">
            {/* Profile Section */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-200">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-3xl shadow-inner">SK</div>
                    <button className="absolute -bottom-2 -right-2 h-8 w-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-primary transition-all">
                      <Smartphone size={16} />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Profile Picture</h3>
                    <p className="text-sm text-slate-500 mt-1">JPG, GIF or PNG. Max size of 800K</p>
                    <div className="flex gap-3 mt-4">
                      <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all">Upload New</button>
                      <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">Remove</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-8 grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">First Name</label>
                  <input type="text" defaultValue="Sameer" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last Name</label>
                  <input type="text" defaultValue="Kumar" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                  <input type="email" defaultValue="sameerk0723@gmail.com" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bio</label>
                  <textarea className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" rows={4} placeholder="Tell us about yourself..."></textarea>
                </div>
              </div>
            </section>

            {/* Security Section */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-4 border-b border-slate-200 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Shield size={18} className="text-primary" />
                  Security & Privacy
                </h3>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Two-factor Authentication</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Add an extra layer of security to your account.</p>
                  </div>
                  <div className="h-6 w-11 rounded-full bg-primary relative cursor-pointer">
                    <div className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Session Timeout</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Automatically log out after 30 minutes of inactivity.</p>
                  </div>
                  <div className="h-6 w-11 rounded-full bg-slate-200 relative cursor-pointer">
                    <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm"></div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};
