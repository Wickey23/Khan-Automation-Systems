import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  PhoneCall, 
  Calendar, 
  Zap, 
  BarChart3, 
  Play,
  Users,
  Clock,
  ShieldAlert,
  Plus,
  TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';
import { PublicNav } from '@/src/components/PublicNav';
import { cn } from '@/src/lib/utils';

const features = [
  {
    icon: PhoneCall,
    title: '24/7 AI Call Answering',
    description: 'Never miss a lead again. Our AI answers every call instantly, day or night, with your business tone.',
    color: 'bg-primary-container text-primary'
  },
  {
    icon: Calendar,
    title: 'Appointment Booking',
    description: 'AI handles the scheduling loop directly in your calendar, confirming availability and capturing job details.',
    color: 'bg-emerald-100 text-emerald-600'
  },
  {
    icon: ShieldAlert,
    title: 'Missed-Call Recovery',
    description: 'Automatically follow up with missed calls via SMS to keep prospects engaged before they call a competitor.',
    color: 'bg-rose-100 text-rose-600'
  },
  {
    icon: Users,
    title: 'Team Routing & Escalation',
    description: 'Intelligently route urgent requests to the right technician or staff member based on intent.',
    color: 'bg-indigo-100 text-indigo-600'
  },
  {
    icon: Zap,
    title: 'Operator Workspace',
    description: 'A unified dashboard for your team to monitor AI interactions and take over whenever needed.',
    color: 'bg-amber-100 text-amber-600'
  },
  {
    icon: BarChart3,
    title: 'Admin Reporting',
    description: 'Deep insights into call volume, conversion rates, and AI performance to optimize your operations.',
    color: 'bg-slate-100 text-slate-600'
  }
];

const faqs = [
  {
    question: 'Can we keep our existing business number?',
    answer: 'Yes. You simply forward your calls to a dedicated Front Desk OS number, or we can port your existing line directly into the system.'
  },
  {
    question: 'How long does setup take?',
    answer: 'Most shops are live within 24-48 hours. Our team handles the initial AI training based on your pricing and service list.'
  },
  {
    question: 'Can staff still take over?',
    answer: 'Absolutely. Front Desk OS is designed to assist, not replace. Your team can jump into any live call or message thread at any time.'
  },
  {
    question: 'Does it support SMS and follow-up?',
    answer: 'Yes, full two-way SMS is integrated. The AI uses it for booking confirmations, reminders, and missed-call recovery.'
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface font-sans selection:bg-primary/10 selection:text-primary">
      <PublicNav />

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/10 rounded-full">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Now in Pilot Phase</span>
              </div>
              
              <h1 className="text-6xl md:text-7xl font-extrabold text-on-surface tracking-tight leading-[0.9] lg:leading-[0.85]">
                The AI receptionist that <span className="text-primary italic">actually</span> runs your front desk.
              </h1>
              
              <p className="text-xl text-on-surface-variant max-w-lg leading-relaxed font-medium">
                Missed calls turn into lost jobs faster than most teams realize. Front Desk OS captures every lead, books every job, and recovers every missed opportunity.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link 
                  to="/app"
                  className="w-full sm:w-auto px-8 py-4 bg-primary text-on-primary rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                >
                  Start Free Pilot
                  <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link 
                  to="/solutions"
                  className="w-full sm:w-auto px-8 py-4 bg-surface-container-high text-on-surface rounded-2xl font-bold text-lg hover:bg-surface-container-highest transition-all flex items-center justify-center gap-3"
                >
                  <Play size={18} fill="currentColor" />
                  See How It Works
                </Link>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-highest overflow-hidden">
                      <img 
                        src={`https://picsum.photos/seed/user${i}/100/100`} 
                        alt="User" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm font-bold text-on-surface-variant">
                  Trusted by <span className="text-on-surface">50+ service shops</span> across the US
                </p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10 bg-surface-container-low rounded-3xl border border-outline-variant/10 shadow-2xl overflow-hidden aspect-[4/3] group">
                <img 
                  src="https://picsum.photos/seed/dashboard/1200/900" 
                  alt="Front Desk OS Dashboard" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-8">
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 w-full flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                        <PhoneCall size={24} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Live Call</p>
                        <p className="text-lg font-bold text-white">AI answering for Apex Climate...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-white uppercase tracking-widest">Active</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-extrabold text-on-surface tracking-tight leading-tight">
                What breaks today + <br />
                <span className="text-primary">How Front Desk OS fixes it</span>
              </h2>
              <p className="text-lg text-on-surface-variant leading-relaxed">
                Traditional receptionists are human—they get overwhelmed, go home at 5 PM, and miss calls during lunch. Every missed call is a customer who immediately calls your competitor.
              </p>
              
              <div className="space-y-4 pt-4">
                {[
                  '24/7 coverage without overtime pay',
                  'Instant missed-call follow-up via SMS',
                  'Automated booking that respects your calendar',
                  'Intent-based routing for urgent emergencies'
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={16} />
                    </div>
                    <span className="text-on-surface font-bold text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-6 pt-12">
                <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 space-y-3">
                  <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center">
                    <ShieldAlert size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-on-surface">The Leak</h4>
                  <p className="text-xs text-on-surface-variant">35% of service calls go to voicemail and never call back.</p>
                </div>
                <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 space-y-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-on-surface">The Delay</h4>
                  <p className="text-xs text-on-surface-variant">Average response time for web leads is 4+ hours.</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-primary p-6 rounded-2xl shadow-xl shadow-primary/20 space-y-3">
                  <div className="w-10 h-10 bg-white/20 text-white rounded-lg flex items-center justify-center">
                    <Zap size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-white">The Fix</h4>
                  <p className="text-xs text-white/80">AI answers in 2 rings and books the job in under 3 minutes.</p>
                </div>
                <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 space-y-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                    <TrendingUp size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-on-surface">The Result</h4>
                  <p className="text-xs text-on-surface-variant">22% increase in monthly revenue from recovered leads.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-4xl font-extrabold text-on-surface tracking-tight">Built for the actual front desk operating loop.</h2>
            <p className="text-lg text-on-surface-variant font-medium">
              We didn't just build a chatbot. We built a system that integrates with how your shop actually works.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div 
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 hover:shadow-xl hover:shadow-primary/5 transition-all group"
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
                  feature.color
                )}>
                  <feature.icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-3">{feature.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed font-medium">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-on-surface rounded-[3rem] p-12 md:p-20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  Pilot-first pricing built for <span className="text-primary">disciplined rollout.</span>
                </h2>
                <p className="text-lg text-white/60 leading-relaxed">
                  We don't believe in long-term contracts for software you haven't tested. Start with a 30-day pilot and see the ROI for yourself.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Link 
                    to="/pricing"
                    className="w-full sm:w-auto px-8 py-4 bg-primary text-on-primary rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    View Pricing Plans
                    <ArrowRight size={20} />
                  </Link>
                  <Link 
                    to="/contact"
                    className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                  >
                    Book a Strategy Call
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: 'Founding Partner', price: '$499', desc: 'For single-location shops' },
                  { label: 'Standard', price: '$999', desc: 'For growing multi-van teams' },
                  { label: 'Growth / Pro', price: 'Custom', desc: 'For enterprise operations' }
                ].map((plan) => (
                  <div key={plan.label} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between group hover:bg-white/10 transition-all">
                    <div>
                      <h4 className="text-white font-bold">{plan.label}</h4>
                      <p className="text-white/40 text-xs">{plan.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-white">{plan.price}</p>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Per Month</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-extrabold text-on-surface tracking-tight">Questions teams usually ask before rollout.</h2>
            <p className="text-on-surface-variant font-medium">Everything you need to know to get started with Front Desk OS.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <h4 className="text-lg font-bold text-on-surface">{faq.question}</h4>
                  <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center transition-transform group-open:rotate-180">
                    <Plus size={18} className="group-open:hidden" />
                    <Minus size={18} className="hidden group-open:block" />
                  </div>
                </summary>
                <div className="px-6 pb-6 text-on-surface-variant text-sm leading-relaxed font-medium">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent)]" />
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10 space-y-8">
          <h2 className="text-5xl md:text-6xl font-extrabold text-on-primary tracking-tight leading-tight">
            Ready for a disciplined <br /> operational rollout?
          </h2>
          <p className="text-xl text-on-primary/80 max-w-2xl mx-auto font-medium">
            Join the shops that are already reclaiming their front desk. Start your 30-day pilot today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link 
              to="/app"
              className="w-full sm:w-auto px-10 py-5 bg-white text-primary rounded-2xl font-bold text-xl shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              Get Started Now
              <ArrowRight size={24} />
            </Link>
            <Link 
              to="/contact"
              className="w-full sm:w-auto px-10 py-5 bg-primary-container text-primary rounded-2xl font-bold text-xl hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-3"
            >
              Contact Sales
            </Link>
          </div>
          <p className="text-on-primary/60 text-sm font-bold uppercase tracking-widest">
            No credit card required for pilot setup
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-outline-variant/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 primary-gradient rounded-lg flex items-center justify-center text-white">
              <Sparkles size={18} fill="currentColor" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tight text-on-surface leading-none">Front Desk OS</span>
              <span className="text-[10px] font-bold text-outline uppercase tracking-widest mt-0.5">by Khan Systems</span>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            {['Solutions', 'Pricing', 'Case Studies', 'Contact'].map((item) => (
              <Link 
                key={item} 
                to={`/${item.toLowerCase().replace(' ', '-')}`}
                className="text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-widest"
              >
                {item}
              </Link>
            ))}
          </div>

          <p className="text-xs text-on-surface-variant font-medium">
            © 2026 Khan Systems. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Minus({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
