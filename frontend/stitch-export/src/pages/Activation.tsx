import React from 'react';
import { 
  Rocket, 
  Check, 
  Lock, 
  MoreHorizontal, 
  ChevronRight, 
  Phone, 
  MessageSquare, 
  Calendar,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

const steps = [
  { id: '01', title: 'Workspace Profile', detail: 'Business hours, address, and contact info', status: 'completed' },
  { id: '02', title: 'Phone Number Porting', detail: 'Verification of +1 (555) 012-3456 completed', status: 'completed' },
  { id: '03', title: 'AI Persona Setup', detail: 'Configure voice tone and greeting protocols', status: 'active' },
  { id: '04', title: 'Calendar Integration', detail: 'Connect Google or Outlook for auto-booking', status: 'locked' },
];

export default function ActivationPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">System Activation</h1>
          <p className="text-on-surface-variant max-w-md">Your AI receptionist is nearly ready. Complete the remaining steps to begin handling customer calls automatically.</p>
        </div>
        <div className="w-full md:w-72">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Activation Progress</span>
            <span className="text-sm font-semibold text-on-surface">75%</span>
          </div>
          <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full w-[75%] transition-all duration-1000"></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <section className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <ShieldCheck className="text-primary" size={96} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Ready to Go-Live</span>
              </div>
              <h2 className="text-2xl font-bold text-on-surface mb-6">System Status: Ready</h2>
              <button className="bg-gradient-to-br from-primary to-primary-dim text-white px-8 py-3.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center gap-3">
                Go Live Now <Zap size={18} />
              </button>
            </div>
          </section>

          <section className="bg-surface-container-low rounded-xl p-8">
            <h3 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
              <Rocket className="text-primary" size={20} />
              Activation Steps
            </h3>
            <div className="space-y-4">
              {steps.map((step) => (
                <div 
                  key={step.id} 
                  className={cn(
                    "p-4 rounded-lg flex items-center justify-between transition-colors",
                    step.status === 'completed' && "bg-surface-container-lowest hover:bg-white",
                    step.status === 'active' && "bg-white ring-1 ring-primary/20 shadow-sm",
                    step.status === 'locked' && "bg-surface-container-low/50 opacity-60"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      step.status === 'completed' && "bg-secondary-container text-on-secondary-container",
                      step.status === 'active' && "border-2 border-primary border-dashed text-primary",
                      step.status === 'locked' && "bg-surface-container-highest text-on-surface-variant"
                    )}>
                      {step.status === 'completed' ? <Check size={16} /> : (
                        step.status === 'locked' ? <Lock size={14} /> : <span className="text-[10px] font-bold">{step.id}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-on-surface">{step.title}</div>
                      <div className="text-xs text-on-surface-variant">{step.detail}</div>
                    </div>
                  </div>
                  {step.status === 'completed' && (
                    <span className="text-[10px] font-bold uppercase text-on-secondary-container bg-secondary-container px-2 py-1 rounded">Completed</span>
                  )}
                  {step.status === 'active' && (
                    <button className="text-xs font-bold text-primary hover:underline">Continue</button>
                  )}
                  {step.status === 'locked' && (
                    <MoreHorizontal className="text-on-surface-variant" size={18} />
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <section className="bg-surface-container-high rounded-xl p-8 border border-white/40">
            <h3 className="text-lg font-bold text-on-surface mb-2">Test Your System</h3>
            <p className="text-sm text-on-surface-variant mb-6">Verify the AI experience before your customers do.</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: Phone, label: 'Call Your Number', color: 'bg-primary-container text-primary' },
                { icon: MessageSquare, label: 'Send a Test SMS', color: 'bg-tertiary-container text-tertiary' },
                { icon: Calendar, label: 'Request Test Appointment', color: 'bg-secondary-container text-secondary' },
              ].map((item) => (
                <button key={item.label} className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg group hover:translate-x-1 transition-all active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded flex items-center justify-center group-hover:scale-110 transition-transform", item.color)}>
                      <item.icon size={20} />
                    </div>
                    <span className="text-sm font-semibold text-on-surface">{item.label}</span>
                  </div>
                  <ChevronRight className="text-outline" size={18} />
                </button>
              ))}
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm border border-outline-variant/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-on-surface tracking-tight">First Success Preview</h3>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded">SIMULATION</span>
            </div>
            <div className="space-y-6">
              <p className="text-sm text-on-surface-variant leading-relaxed italic">"Once live, your first successful appointment will look like this in your activity log..."</p>
              <div className="relative bg-surface p-6 rounded-xl border border-outline-variant/20">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <div className="w-3 h-3 rounded-full bg-secondary ring-4 ring-secondary-container"></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-on-surface">New Booking Confirmed</span>
                      <span className="text-[10px] text-on-surface-variant">Just now</span>
                    </div>
                    <div className="text-xs text-on-surface-variant mb-4">Caller: Sarah Henderson</div>
                    <div className="bg-surface-container-low p-4 rounded-lg space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-on-surface-variant">Service:</span>
                        <span className="font-medium text-on-surface">Initial Consultation</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-on-surface-variant">Time:</span>
                        <span className="font-medium text-on-surface">Oct 24, 10:30 AM</span>
                      </div>
                      <div className="pt-2 border-t border-outline-variant/20">
                        <div className="text-[10px] font-bold text-primary uppercase tracking-tighter mb-1">AI Agent Summary</div>
                        <p className="text-[11px] leading-snug text-on-surface-variant">Sarah was looking for a quote on system migration. I've booked her for a session with a specialist.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck size={18} />
                <span className="text-xs font-bold tracking-wide">High-Trust Architecture Active</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
