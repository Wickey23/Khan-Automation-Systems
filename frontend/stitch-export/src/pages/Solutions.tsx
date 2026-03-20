import React from 'react';
import { 
  PhoneCall, 
  CheckSquare, 
  Zap, 
  CalendarCheck, 
  ArrowRight,
  Headset,
  MessageSquare,
  Sparkles,
  Calendar,
  Wrench,
  Truck,
  Zap as SparkIcon,
  Droplets
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

const steps = [
  {
    id: '01',
    title: 'Capture',
    icon: PhoneCall,
    color: 'primary',
    description: 'AI answers within 2 rings, 24/7. No more voicemail tag or lost leads. Every caller is greeted professionally by a voice that sounds like your best employee.',
    detail: 'AI Active: Capturing Incoming Call...'
  },
  {
    id: '02',
    title: 'Qualify',
    icon: CheckSquare,
    color: 'secondary',
    description: 'The AI identifies the specific service need—be it HVAC, Plumbing, or Electrical—and assesses customer urgency to prioritize your dispatch.',
    detail: 'Intent: Emergency Repair Detected'
  },
  {
    id: '03',
    title: 'Automate',
    icon: Zap,
    color: 'tertiary',
    description: 'Instant follow-up via SMS for confirmation or if a customer needs to wait, keeping them engaged and preventing them from calling your competitor.',
    detail: 'SMS Sent: "Technician is 10 mins away"'
  },
  {
    id: '04',
    title: 'Resolve',
    icon: CalendarCheck,
    color: 'primary',
    description: 'The AI syncs directly with your calendar and confirms the appointment in real-time. You just show up and do the work.',
    detail: 'Booking Confirmed: Today at 4:30 PM'
  }
];

const integrations = [
  { name: 'Google Calendar', icon: Calendar },
  { name: 'ServiceTitan', icon: Wrench },
  { name: 'Jobber', icon: CalendarCheck },
  { name: 'Zapier', icon: Zap }
];

const trustLogos = [
  { name: 'Wrench', icon: Wrench },
  { name: 'Truck', icon: Truck },
  { name: 'Spark', icon: SparkIcon },
  { name: 'Flow', icon: Droplets }
];

export default function Solutions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface">
      <nav className="fixed top-0 w-full z-50 bg-slate-50/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 h-16">
          <Link to="/" className="text-xl font-bold tracking-tight text-slate-900">Khan Systems</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link className="text-blue-600 border-b-2 border-blue-600 pb-1 text-sm font-medium" to="/solutions">Solutions</Link>
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" to="/pricing">Pricing</Link>
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" to="/case-studies">Case Studies</Link>
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" to="/contact">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className="primary-gradient text-on-primary px-5 py-2 rounded-md text-sm font-medium shadow-sm active:scale-95 duration-150"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-32 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="max-w-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs font-semibold tracking-wider text-on-surface-variant uppercase">New: AI Voice Response</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-medium tracking-tight text-on-surface leading-[1.1] mb-6"
            >
              The Silent Orchestrator for Service Businesses
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-on-surface-variant leading-relaxed mb-10 max-w-lg"
            >
              Automate missed calls, follow-ups, and bookings for HVAC, plumbing, and repair teams. Reclaim your focus while our system handles the noise.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-8 py-4 bg-primary text-on-primary font-semibold rounded-lg shadow-lg active:scale-95 transition-all text-base"
              >
                Get Started
              </button>
              <button 
                onClick={() => navigate('/contact')}
                className="px-8 py-4 bg-surface-container-lowest text-on-surface font-semibold rounded-lg border border-outline-variant/20 hover:bg-surface-container-low active:scale-95 transition-all text-base shadow-sm"
              >
                Book a Demo
              </button>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/5 to-tertiary/5 rounded-3xl blur-3xl -z-10"></div>
            <div className="bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/10 rounded-2xl shadow-2xl p-4 md:p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary-container rounded-full flex items-center justify-center text-on-secondary-container">
                      <Headset size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-on-surface">Missed Call Recovery</div>
                      <div className="text-xs text-on-surface-variant">Active Automation</div>
                    </div>
                  </div>
                  <div className="px-2 py-1 bg-primary-container text-on-primary-container text-[10px] font-bold rounded">LIVE</div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-surface-container-low rounded-xl flex items-start gap-4">
                    <PhoneCall size={18} className="text-primary mt-1" />
                    <div>
                      <div className="text-sm font-semibold">Incoming: HVAC Emergency</div>
                      <p className="text-xs text-on-surface-variant mt-1">Caller: Mike Rossi • (555) 0124</p>
                    </div>
                  </div>
                  <div className="p-4 bg-white border border-surface-container-high rounded-xl flex items-start gap-4 shadow-sm">
                    <Sparkles size={18} className="text-tertiary mt-1" />
                    <div>
                      <div className="text-sm font-semibold">Khan Orchestrator Response</div>
                      <p className="text-xs italic text-on-surface-variant mt-1">"Sent automated text: 'Hi Mike, sorry we missed you. Do you need an emergency repair today?'"</p>
                    </div>
                  </div>
                  <div className="p-4 bg-secondary-container/30 rounded-xl flex items-start gap-4">
                    <CalendarCheck size={18} className="text-secondary mt-1" />
                    <div>
                      <div className="text-sm font-semibold">Booking Confirmed</div>
                      <p className="text-xs text-on-surface-variant mt-1">Technician assigned: Alex • Today at 4:30 PM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-surface-container-low py-12">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[0.2em] text-on-surface-variant uppercase mb-10">Trusted by modern service leaders</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-24 opacity-60">
            {trustLogos.map((logo) => (
              <div key={logo.name} className="flex items-center gap-3">
                <logo.icon size={24} />
                <span className="text-lg font-bold tracking-tight">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step-by-Step Breakdown */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-medium tracking-tight mb-4 text-on-surface">Efficiency without the noise.</h2>
          <p className="text-on-surface-variant">Built for the specific operational demands of field service teams who can't afford to drop the ball.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {steps.map((step, i) => (
            <motion.div 
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "rounded-2xl p-8 flex flex-col justify-between border border-outline-variant/10 shadow-sm transition-all hover:shadow-md",
                i % 3 === 0 ? "md:col-span-7 bg-surface-container-lowest" : "md:col-span-5 bg-surface-container-low"
              )}
            >
              <div>
                <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center mb-6",
                  step.color === 'primary' && "bg-primary-container text-primary",
                  step.color === 'secondary' && "bg-secondary-container text-secondary",
                  step.color === 'tertiary' && "bg-tertiary-container text-tertiary",
                )}>
                  <step.icon size={24} />
                </div>
                <span className="text-primary font-bold text-xs tracking-widest uppercase mb-2 block">Step {step.id}</span>
                <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                <p className="text-on-surface-variant text-base leading-relaxed">
                  {step.description}
                </p>
              </div>
              <div className="mt-8 p-4 bg-surface-container-highest/30 rounded-xl flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <span className="text-xs font-medium text-on-surface-variant">{step.detail}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Integration Highlight */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <h2 className="text-4xl font-extrabold mb-4">Connects with Your Tools</h2>
        <p className="text-lg text-on-surface-variant mb-16 max-w-2xl mx-auto">Khan Systems plugs directly into the software you already use to run your business. No learning curve, just better results.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {integrations.map((item) => (
            <div key={item.name} className="p-8 bg-surface-container-low rounded-xl flex flex-col items-center justify-center transition-all hover:bg-surface-container-high group">
              <item.icon size={40} className="mb-4 text-primary transition-transform group-hover:scale-110" />
              <span className="font-bold">{item.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-6 py-24 mb-12">
        <div className="bg-on-surface text-on-primary p-12 md:p-24 rounded-[2rem] text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none"></div>
          <h2 className="text-4xl md:text-5xl font-medium mb-8 max-w-2xl mx-auto leading-tight">Ready to let the orchestrator take the baton?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-10 py-5 bg-primary text-white font-bold rounded-xl active:scale-95 transition-all text-lg shadow-lg hover:shadow-primary/20"
            >
              Start Free Trial
            </button>
            <button 
              onClick={() => navigate('/contact')}
              className="px-10 py-5 bg-white/10 backdrop-blur-md text-white border border-white/20 font-bold rounded-xl active:scale-95 transition-all text-lg"
            >
              Speak to Sales
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
