"use client";

import React from 'react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Check } from 'lucide-react';
import { motion } from "framer-motion";

const tiers = [
  {
    name: 'Starter',
    price: '$49',
    description: 'Perfect for solo operators and small shops.',
    features: ['50 AI Voice Minutes', 'SMS Follow-ups', '1 Calendar Integration'],
    buttonText: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$149',
    description: 'For growing teams requiring high automation.',
    features: ['1,000 AI Voice Minutes', 'SMS Follow-ups', 'Unlimited Calendars', 'Priority Support'],
    buttonText: 'Get Started with Pro',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Custom solutions for large-scale enterprises.',
    features: ['Unlimited Voice Minutes', 'Custom AI Voice Training', 'Dedicated Account Manager'],
    buttonText: 'Contact Sales',
    popular: false,
  },
];

export default function PricingPage() {
  const router = useRouter();

  return (
    <div className="bg-background min-h-screen">
      <nav className="fixed top-0 w-full z-50 bg-slate-50/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 h-16">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">Khan Systems</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" href="/solutions">Solutions</Link>
            <Link className="text-blue-600 border-b-2 border-blue-600 pb-1 text-sm font-medium" href="/pricing">Pricing</Link>
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" href="/case-studies">Case Studies</Link>
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

      <main className="pt-32 pb-24">
        <section className="max-w-7xl mx-auto px-6 mb-20">
          <div className="max-w-3xl">
            <span className="inline-block py-1 px-3 rounded-full bg-primary-container text-on-primary-container text-[10px] font-bold tracking-widest uppercase mb-6">Pricing Plans</span>
            <h1 className="text-5xl font-bold text-on-surface tracking-tight leading-tight mb-6">Simple, transparent pricing for growing service businesses.</h1>
            <p className="text-on-surface-variant text-lg leading-relaxed max-w-2xl">
              Scale your front desk operations with AI-powered voice, automated follow-ups, and seamless calendar synchronization. No hidden fees, just pure efficiency.
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 mb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            {tiers.map((tier) => (
              <div 
                key={tier.name}
                className={tier.popular 
                  ? "relative bg-surface-container-lowest rounded-xl p-8 shadow-2xl shadow-on-surface/5 border border-primary/10 scale-105 z-10"
                  : "bg-surface-container-low rounded-xl p-8 transition-all hover:bg-surface-container-lowest"
                }
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 primary-gradient text-on-primary px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">Most Popular</div>
                )}
                <h3 className="text-xl font-bold text-on-surface mb-2">{tier.name}</h3>
                <p className="text-on-surface-variant text-sm mb-6">{tier.description}</p>
                <div className="mb-8">
                  <span className="text-4xl font-extrabold text-on-surface">{tier.price}</span>
                  {tier.price !== 'Custom' && <span className="text-on-surface-variant">/mo</span>}
                </div>
                <ul className="space-y-4 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-on-surface">
                      <CheckCircle2 size={20} className="text-primary" fill={tier.popular ? "currentColor" : "none"} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => router.push(tier.name === 'Enterprise' ? '/contact' : '/dashboard')}
                  className={tier.popular 
                    ? "w-full py-3 px-4 rounded-lg primary-gradient text-on-primary font-semibold text-sm shadow-md active:scale-[0.98] transition-all"
                    : "w-full py-3 px-4 rounded-lg bg-surface-container-highest text-on-surface font-semibold text-sm hover:bg-surface-container-high transition-colors"
                }>
                  {tier.buttonText}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 mb-32">
          <h2 className="text-3xl font-bold text-on-surface mb-12">Detailed Comparison</h2>
          <div className="bg-surface-container-low rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high/50">
                  <th className="py-6 px-8 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Feature</th>
                  <th className="py-6 px-8 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Starter</th>
                  <th className="py-6 px-8 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Pro</th>
                  <th className="py-6 px-8 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                <tr className="hover:bg-surface-container transition-colors">
                  <td className="py-6 px-8 text-sm font-semibold text-on-surface">AI Voice Minutes</td>
                  <td className="py-6 px-8 text-sm text-on-surface-variant">50 / mo</td>
                  <td className="py-6 px-8 text-sm text-on-surface-variant">1,000 / mo</td>
                  <td className="py-6 px-8 text-sm font-bold text-primary">Unlimited</td>
                </tr>
                <tr className="hover:bg-surface-container transition-colors">
                  <td className="py-6 px-8 text-sm font-semibold text-on-surface">SMS Automated Follow-ups</td>
                  <td className="py-6 px-8 text-sm text-primary"><Check size={18} /></td>
                  <td className="py-6 px-8 text-sm text-primary"><Check size={18} /></td>
                  <td className="py-6 px-8 text-sm text-primary"><Check size={18} /></td>
                </tr>
                <tr className="hover:bg-surface-container transition-colors">
                  <td className="py-6 px-8 text-sm font-semibold text-on-surface">Calendar Integrations</td>
                  <td className="py-6 px-8 text-sm text-on-surface-variant">1 account</td>
                  <td className="py-6 px-8 text-sm text-on-surface-variant">Unlimited</td>
                  <td className="py-6 px-8 text-sm text-on-surface-variant">Unlimited</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6">
          <div className="primary-gradient rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-20 -mb-20 blur-3xl"></div>
            <h2 className="text-4xl md:text-5xl font-bold text-on-primary mb-8 relative z-10">Ready to automate your front desk?</h2>
            <div className="flex flex-col md:flex-row justify-center items-center gap-4 relative z-10">
              <button 
                onClick={() => router.push('/dashboard')}
                className="bg-surface-container-lowest text-primary px-8 py-4 rounded-xl font-bold text-lg shadow-xl hover:scale-105 transition-transform"
              >
                Start Your 14-Day Free Trial
              </button>
              <button 
                onClick={() => router.push('/contact')}
                className="text-on-primary border border-on-primary/30 px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
              >
                Book a Live Demo
              </button>
            </div>
            <p className="text-on-primary/70 mt-8 text-sm relative z-10">No credit card required for trial. Cancel anytime.</p>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-slate-200 bg-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="text-lg font-bold text-slate-800">Khan Systems</div>
            <div className="text-xs text-slate-500">© 2024 Khan Systems Inc. All rights reserved.</div>
          </div>
          <div className="flex gap-8 text-sm font-semibold text-slate-500">
            <a className="hover:text-blue-600 transition-colors" href="#">Privacy Policy</a>
            <a className="hover:text-blue-600 transition-colors" href="#">Terms of Service</a>
            <a className="hover:text-blue-600 transition-colors" href="#">Security</a>
            <a className="hover:text-blue-600 transition-colors" href="#">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
