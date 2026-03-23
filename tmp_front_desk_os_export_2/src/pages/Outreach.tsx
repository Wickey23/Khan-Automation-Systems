import React from 'react';
import { 
  Rocket, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Target, 
  BarChart3 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Outreach: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-background-light overflow-y-auto">
      <div className="max-w-4xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-6">
            <Rocket size={14} />
            Coming Soon
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
            Automate your <span className="text-primary">Outreach</span> <br />
            with AI-powered Precision
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            We're building the most advanced outbound engine for your front desk. 
            Automate follow-ups, re-engage cold leads, and book more appointments effortlessly.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-3 gap-8 mb-16">
          {[
            { 
              title: 'Smart Follow-ups', 
              desc: 'AI-driven SMS and email sequences that adapt to lead behavior.', 
              icon: Zap,
              color: 'bg-amber-100 text-amber-600'
            },
            { 
              title: 'Lead Scoring', 
              desc: 'Automatically prioritize leads based on engagement and intent.', 
              icon: Target,
              color: 'bg-emerald-100 text-emerald-600'
            },
            { 
              title: 'Performance Analytics', 
              desc: 'Deep insights into your outreach ROI and conversion rates.', 
              icon: BarChart3,
              color: 'bg-blue-100 text-blue-600'
            },
          ].map((feature, i) => (
            <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center mb-6", feature.color)}>
                <feature.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Waitlist Form */}
        <div className="bg-slate-900 rounded-3xl p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-10 left-10 h-32 w-32 rounded-full bg-primary blur-3xl"></div>
            <div className="absolute bottom-10 right-10 h-32 w-32 rounded-full bg-primary blur-3xl"></div>
          </div>
          
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center gap-3">
              <Sparkles className="text-primary" />
              Join the Early Access Waitlist
            </h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto">
              Be the first to know when we launch and get exclusive early-bird pricing.
            </p>
            
            <form className="flex gap-3 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
              <div className="flex-1 relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="email" 
                  placeholder="Enter your email address" 
                  className="w-full rounded-xl bg-slate-800 border-slate-700 px-12 py-4 text-white placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>
              <button className="px-8 py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
                Join Now
                <ArrowRight size={18} />
              </button>
            </form>
            <p className="text-[10px] text-slate-500 mt-6 uppercase tracking-widest font-bold">
              No spam, ever. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
