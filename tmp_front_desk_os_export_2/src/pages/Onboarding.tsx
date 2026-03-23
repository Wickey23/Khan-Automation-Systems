import React, { useState } from 'react';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Building2, 
  Users, 
  Globe, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export const Onboarding: React.FC = () => {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const steps = [
    { title: 'Business Info', icon: Building2 },
    { title: 'Team Setup', icon: Users },
    { title: 'Preferences', icon: Globe },
    { title: 'Review', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-background-light flex flex-col">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Sparkles size={24} />
          </div>
          <span className="text-xl font-extrabold text-slate-900 tracking-tight">Front Desk OS</span>
        </div>
        <Link to="/app" className="text-sm font-bold text-slate-500 hover:text-primary transition-colors">Save & Exit</Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-12">
        <div className="w-full max-w-2xl">
          {/* Progress Bar */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              {steps.map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-all duration-500",
                    step > i + 1 ? "bg-emerald-500 text-white" : 
                    step === i + 1 ? "bg-primary text-white shadow-lg shadow-primary/20" : 
                    "bg-white border border-slate-200 text-slate-400"
                  )}>
                    {step > i + 1 ? <Check size={20} /> : <s.icon size={20} />}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    step === i + 1 ? "text-primary" : "text-slate-400"
                  )}>{s.title}</span>
                </div>
              ))}
            </div>
            <div className="relative h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-12">
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900">Tell us about your business</h2>
                  <p className="text-slate-500 mt-2">We'll customize your workspace based on your industry and size.</p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Business Name</label>
                    <input type="text" placeholder="e.g. Acme Dental" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-base focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Industry</label>
                    <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-base focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none">
                      <option>Healthcare & Medical</option>
                      <option>Real Estate</option>
                      <option>Professional Services</option>
                      <option>Retail & E-commerce</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Company Size</label>
                      <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-base focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none">
                        <option>1-10 employees</option>
                        <option>11-50 employees</option>
                        <option>51-200 employees</option>
                        <option>200+ employees</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Location</label>
                      <input type="text" placeholder="e.g. New York, NY" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-base focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900">Invite your team</h2>
                  <p className="text-slate-500 mt-2">Collaborate with your colleagues to manage leads and calls.</p>
                </div>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                      <input type="email" placeholder="colleague@example.com" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
                      <select className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none">
                        <option>Admin</option>
                        <option>Operator</option>
                        <option>Viewer</option>
                      </select>
                    </div>
                  ))}
                  <button className="text-sm font-bold text-primary hover:underline mt-2 flex items-center gap-2">
                    <Plus size={16} /> Add another member
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900">Set your preferences</h2>
                  <p className="text-slate-500 mt-2">Configure how you'd like to receive notifications and alerts.</p>
                </div>
                <div className="space-y-6">
                  {[
                    { label: 'Email Notifications', desc: 'Receive daily summaries and urgent alerts via email.' },
                    { label: 'SMS Alerts', desc: 'Get instant text messages for high-priority leads.' },
                    { label: 'Browser Push', desc: 'Stay updated with real-time desktop notifications.' },
                  ].map((pref, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{pref.label}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{pref.desc}</p>
                      </div>
                      <div className="h-6 w-11 rounded-full bg-primary relative cursor-pointer">
                        <div className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
                <div className="flex justify-center">
                  <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Check size={48} />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900">You're all set!</h2>
                  <p className="text-slate-500 mt-2">Your workspace is ready. You can now start managing your front desk operations.</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Business</span>
                      <span className="font-bold text-slate-900">Acme Dental</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Team Members</span>
                      <span className="font-bold text-slate-900">3 Invited</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Plan</span>
                      <span className="font-bold text-emerald-600 uppercase tracking-wider">Professional</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-12 flex items-center justify-between">
              <button 
                onClick={() => setStep(s => Math.max(1, s - 1))}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all",
                  step === 1 && "invisible"
                )}
              >
                <ChevronLeft size={20} />
                Back
              </button>
              {step < totalSteps ? (
                <button 
                  onClick={() => setStep(s => Math.min(totalSteps, s + 1))}
                  className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                >
                  Continue
                  <ChevronRight size={20} />
                </button>
              ) : (
                <Link 
                  to="/app"
                  className="flex items-center gap-2 px-10 py-4 bg-primary text-white rounded-xl font-bold shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all animate-pulse"
                >
                  Go to Dashboard
                  <ArrowRight size={20} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const Plus: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
