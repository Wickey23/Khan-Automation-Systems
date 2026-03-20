"use client";

import React from 'react';
import { 
  CheckCircle2, 
  ArrowRight, 
  Quote,
  Star
} from 'lucide-react';
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from '@/lib/utils';

const caseStudies = [
  {
    title: 'Apex Climate Solutions',
    industry: 'HVAC',
    metric: '+42% Booking Rate',
    description: 'Rapid growth led to 30% of calls going to voicemail. Our AI agent now handles 100% of after-hours triage and scheduling.',
    image: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ec3?auto=format&fit=crop&q=80&w=800',
    status: 'Proven live'
  },
  {
    title: 'Flowstate Plumbing',
    industry: 'Plumbing',
    metric: '100% Calls Captured',
    description: 'Eliminating the "leaky bucket" of lead generation by instantly responding to emergency SMS queries via automated workflows.',
    image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=800',
    status: 'Proven live'
  },
  {
    title: 'Titan Towing & Recovery',
    industry: 'Towing',
    metric: '24/7 Dispatch',
    description: 'Automated voice response reduced dispatch time by 12 minutes per call, allowing drivers to reach sites faster.',
    image: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&q=80&w=800',
    status: 'Proven live'
  },
  {
    title: 'Volt Masters',
    industry: 'Electrical',
    metric: 'Zero Missed Leads',
    description: 'Integrated SMS capture ensures that even when technicians are on a roof, the customer gets an instant response and booking.',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800',
    status: 'Proven live'
  },
  {
    title: 'Pristine Appliance',
    industry: 'Appliance Repair',
    metric: '+50% Efficiency',
    description: 'Automated parts tracking and status updates via SMS reduced "Where is my technician?" calls by half.',
    image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=80&w=800',
    status: 'Proven live'
  },
  {
    title: 'Eco-Chill HVAC',
    industry: 'HVAC',
    metric: 'ROI in 14 Days',
    description: 'Scaling from 2 trucks to 10 without hiring a single additional office staff member. The definition of efficient growth.',
    image: 'https://images.unsplash.com/photo-1599939571322-792a326991f2?auto=format&fit=crop&q=80&w=800',
    status: 'Proven live'
  }
];

const testimonials = [
  {
    quote: "Before CaseFlow, I was answering calls under a kitchen sink. Now the AI handles the first touch and I just show up to book jobs. It's a game changer.",
    author: "Mark Henderson",
    company: "Henderson HVAC",
    avatar: "https://i.pravatar.cc/150?u=mark"
  },
  {
    quote: "The SMS automation means we don't lose leads to the competitor down the street just because we didn't pick up the phone in 30 seconds.",
    author: "Sarah Jenkins",
    company: "Rapid Response Towing",
    avatar: "https://i.pravatar.cc/150?u=sarah"
  },
  {
    quote: "It felt like I hired three receptionists overnight, but for a fraction of the cost. The AI sounds professional and actually knows our pricing.",
    author: "James Chen",
    company: "Flowstate Plumbing",
    avatar: "https://i.pravatar.cc/150?u=james"
  }
];

export default function CaseStudies() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-surface">
      <nav className="fixed top-0 w-full z-50 bg-slate-50/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 h-16">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">Khan Systems</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" href="/solutions">Solutions</Link>
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" href="/pricing">Pricing</Link>
            <Link className="text-blue-600 border-b-2 border-blue-600 pb-1 text-sm font-medium" href="/case-studies">Case Studies</Link>
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" href="/contact">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/dashboard')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={() => router.push('/dashboard')}
              className="primary-gradient text-on-primary px-5 py-2 rounded-md text-sm font-medium shadow-sm active:scale-95 duration-150"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl">
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold tracking-widest uppercase mb-6"
            >
              Operational success
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-extrabold text-on-surface tracking-tight mb-8 leading-[1.1]"
            >
              Real results for real service businesses.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-on-surface-variant leading-relaxed max-w-2xl font-body"
            >
              See how elite plumbing, HVAC, and towing teams use AI voice and SMS to capture missed opportunities and automate their front desk operations.
            </motion.p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-1/2 h-full bg-surface-container-low -skew-x-12 translate-x-32 z-0"></div>
      </section>

      {/* Filter Bar & Grid */}
      <section className="px-8 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3 mb-16 overflow-x-auto pb-4 scrollbar-hide">
            {['All', 'HVAC', 'Plumbing', 'Towing', 'Electrical', 'Appliance Repair'].map((filter, i) => (
              <button 
                key={filter}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-medium transition-all shadow-sm",
                  i === 0 ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                )}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {caseStudies.map((study, i) => (
              <motion.div 
                key={study.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-outline-variant/10"
              >
                <div className="relative h-56 overflow-hidden">
                  <img 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    src={study.image} 
                    alt={study.title}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20 shadow-sm">
                    <span className="text-primary font-bold text-lg">{study.metric}</span>
                  </div>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold tracking-tight">{study.title}</h3>
                    <span className="text-[10px] font-bold text-outline uppercase tracking-wider">{study.industry}</span>
                  </div>
                  <p className="text-on-surface-variant text-sm leading-relaxed mb-6 flex-grow">
                    {study.description}
                  </p>
                  <div className="flex items-center justify-between pt-6 border-t border-outline-variant/10">
                    <span className="text-xs font-semibold text-secondary flex items-center gap-1">
                      <CheckCircle2 size={14} className="text-primary" /> {study.status}
                    </span>
                    <button className="text-primary text-sm font-bold flex items-center gap-1 group/link hover:underline">
                      Read Story <ArrowRight size={14} className="transition-transform group-hover/link:translate-x-1" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="bg-surface-container-low py-32 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Voice of the Fleet</h2>
            <p className="text-on-surface-variant max-w-xl mx-auto font-body">Real words from business owners who decided to reclaim their focus.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-surface-container-lowest p-8 rounded-xl relative border border-outline-variant/10"
              >
                <Quote className="text-primary/10 absolute top-4 right-8 w-16 h-16" />
                <p className="text-on-surface font-medium leading-relaxed mb-8 relative z-10 italic">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high overflow-hidden border-2 border-white shadow-sm">
                    <img className="w-full h-full object-cover" src={t.avatar} alt={t.author} referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.author}</p>
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">{t.company}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-8 overflow-hidden relative">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">Ready to automate your front desk?</h2>
          <p className="text-on-surface-variant text-lg mb-12 max-w-2xl mx-auto">
            Join hundreds of service businesses that never miss a call. Setup takes less than 30 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => router.push('/dashboard')}
              className="w-full sm:w-auto bg-primary text-on-primary px-8 py-4 rounded-lg font-bold tracking-tight shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
            >
              Get Started
            </button>
            <button 
              onClick={() => router.push('/contact')}
              className="w-full sm:w-auto bg-surface-container-highest text-on-surface px-8 py-4 rounded-lg font-bold tracking-tight hover:bg-surface-container-high transition-all active:scale-95"
            >
              Book a Demo
            </button>
          </div>
        </div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      </section>
    </div>
  );
}
