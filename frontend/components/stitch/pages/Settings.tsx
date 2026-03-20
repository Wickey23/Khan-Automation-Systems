"use client";

import React from 'react';
import { 
  Settings, 
  User, 
  Phone, 
  Zap, 
  Calendar, 
  Bell, 
  Shield, 
  Globe,
  ChevronRight,
  Save
} from 'lucide-react';
import { cn } from '@/lib/utils';

const sections = [
  { id: 'profile', icon: User, label: 'Workspace Profile', detail: 'Business info, hours, and branding' },
  { id: 'phone', icon: Phone, label: 'Phone & Voice', detail: 'Number porting and AI voice config' },
  { id: 'ai', icon: Zap, label: 'AI Receptionist Config', detail: 'Persona, protocols, and knowledge base' },
  { id: 'calendar', icon: Calendar, label: 'Calendar Sync', detail: 'Integrations and booking rules' },
  { id: 'notifications', icon: Bell, label: 'Notifications', detail: 'Alerts, SMS, and email preferences' },
  { id: 'security', icon: Shield, label: 'Security & Access', detail: 'Team members and API keys' },
];

export default function SettingsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Settings</h1>
          <p className="text-on-surface-variant text-sm">Configure your workspace and AI agent behavior.</p>
        </div>
        <button className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
          <Save size={18} /> Save All Changes
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-4 space-y-2">
          {sections.map((section) => (
            <button 
              key={section.id}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left group",
                section.id === 'profile' 
                  ? "bg-primary/5 ring-1 ring-primary/10" 
                  : "hover:bg-surface-container-low"
              )}
            >
              <div className={cn(
                "p-2.5 rounded-lg transition-colors",
                section.id === 'profile' ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant group-hover:bg-surface-container-highest"
              )}>
                <section.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "text-sm font-bold transition-colors",
                  section.id === 'profile' ? "text-primary" : "text-on-surface"
                )}>{section.label}</div>
                <div className="text-[11px] text-on-surface-variant truncate">{section.detail}</div>
              </div>
              <ChevronRight size={16} className={cn(
                "transition-colors",
                section.id === 'profile' ? "text-primary" : "text-on-surface-variant"
              )} />
            </button>
          ))}
        </aside>

        <div className="lg:col-span-8 space-y-8">
          <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/10">
            <h2 className="text-lg font-bold text-on-surface mb-8">Workspace Profile</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Business Name</label>
                  <input 
                    type="text" 
                    defaultValue="Khan Systems Inc."
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Industry</label>
                  <select className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none">
                    <option>Professional Services</option>
                    <option>Healthcare</option>
                    <option>Home Services</option>
                    <option>Real Estate</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Workspace URL</label>
                <div className="flex items-center gap-2">
                  <div className="bg-surface-container-high px-4 py-3 rounded-xl text-sm text-on-surface-variant font-medium">khansystems.ai/</div>
                  <input 
                    type="text" 
                    defaultValue="workspace-alpha"
                    className="flex-1 bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Business Description</label>
                <textarea 
                  rows={4}
                  defaultValue="Leading provider of AI-powered front desk operations for service-based businesses. We specialize in automated voice reception and customer lifecycle management."
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                />
              </div>

              <div className="pt-6 border-t border-outline-variant/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center overflow-hidden border border-outline-variant/10">
                    <Zap className="text-primary" size={24} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-on-surface">Workspace Logo</div>
                    <div className="text-[11px] text-on-surface-variant">SVG, PNG, or JPG (max 2MB)</div>
                  </div>
                </div>
                <button className="text-xs font-bold text-primary hover:underline">Upload New</button>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/10">
            <h2 className="text-lg font-bold text-on-surface mb-8">Regional Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Timezone</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={16} />
                  <select className="w-full bg-surface-container-low border-none rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none">
                    <option>(GMT-08:00) Pacific Time</option>
                    <option>(GMT-05:00) Eastern Time</option>
                    <option>(GMT+00:00) UTC</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Language</label>
                <select className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none">
                  <option>English (US)</option>
                  <option>Spanish</option>
                  <option>French</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
