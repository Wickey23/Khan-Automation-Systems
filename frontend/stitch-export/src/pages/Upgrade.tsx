import React from 'react';
import { 
  CheckCircle2, 
  Lock, 
  Stars, 
  Building2, 
  ArrowRight,
  Zap
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const capabilities = [
  { 
    name: 'Custom AI Voice Training', 
    detail: 'Clone brand-specific voices for outbound calls', 
    pro: false, 
    enterprise: true 
  },
  { 
    name: 'Unlimited SMS & Calls', 
    detail: 'No volume-based tiered pricing', 
    pro: '10k Limit', 
    enterprise: true 
  },
  { 
    name: 'Priority Lead Routing', 
    detail: 'Sub-50ms latency for high-value inquiries', 
    pro: false, 
    enterprise: true 
  },
  { 
    name: 'Dedicated Account Manager', 
    detail: '24/7 technical architect support', 
    pro: false, 
    enterprise: true 
  },
];

export default function UpgradePage() {
  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <section>
        <div className="bg-surface-container-low rounded-xl p-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Upgrade to Enterprise</h1>
            <p className="text-on-surface-variant max-w-xl text-sm">You've reached 80% of your current SMS limit. Scale your operations with advanced AI capabilities and unlimited communication channels.</p>
          </div>
          <div className="w-full md:w-64 space-y-2">
            <div className="flex justify-between text-xs font-bold text-on-surface-variant">
              <span>SMS Usage</span>
              <span>8,142 / 10,000</span>
            </div>
            <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[81%] rounded-full"></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-8">
        {/* Current Plan: Pro */}
        <div className="bg-surface-container-lowest rounded-xl p-10 border-2 border-surface-container-high relative flex flex-col h-full">
          <div className="absolute top-6 right-8">
            <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Current Plan</span>
          </div>
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-on-surface-variant mb-1">Pro</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-on-surface">$499</span>
              <span className="text-on-surface-variant font-medium">/mo</span>
            </div>
          </div>
          <ul className="space-y-4 mb-10 flex-grow">
            {[
              '10,000 SMS & Calls',
              'Standard AI Voice Synthesis',
              'Shared Support Queue'
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-on-surface">
                <CheckCircle2 size={20} className="text-primary" />
                {feature}
              </li>
            ))}
            <li className="flex items-center gap-3 text-sm text-on-surface-variant opacity-60">
              <Lock size={20} />
              Custom AI Voice Training
            </li>
          </ul>
          <button className="w-full py-3 rounded-lg border border-outline-variant text-on-surface-variant font-semibold text-sm cursor-default" disabled>Manage Current Plan</button>
        </div>

        {/* Target Plan: Enterprise */}
        <div className="bg-surface-container-lowest rounded-xl p-10 shadow-xl ring-2 ring-primary relative flex flex-col h-full">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">Recommended</div>
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-primary mb-1">Enterprise</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-on-surface">$1,299</span>
              <span className="text-on-surface-variant font-medium">/mo</span>
            </div>
          </div>
          <ul className="space-y-4 mb-10 flex-grow">
            {[
              'Unlimited SMS & Calls',
              'Custom AI Voice Training',
              'Priority Lead Routing',
              'Dedicated Account Manager'
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-on-surface font-medium">
                <Stars size={20} className="text-primary fill-primary" />
                {feature}
              </li>
            ))}
          </ul>
          <button className="w-full py-3 rounded-lg primary-gradient text-on-primary font-bold text-sm shadow-md active:scale-[0.98] transition-all">Upgrade to Enterprise</button>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-8 text-center">AI & Infrastructure Capabilities</h2>
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/10">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-8 py-4 text-left font-semibold text-sm text-on-surface-variant w-1/2">Capability</th>
                <th className="px-8 py-4 text-center font-semibold text-sm text-on-surface-variant">Pro</th>
                <th className="px-8 py-4 text-center font-semibold text-sm text-on-surface">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/20">
              {capabilities.map((cap) => (
                <tr key={cap.name} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-8 py-6">
                    <div className="font-semibold text-on-surface">{cap.name}</div>
                    <div className="text-xs text-on-surface-variant">{cap.detail}</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {typeof cap.pro === 'string' ? (
                      <span className="text-xs font-medium text-on-surface-variant">{cap.pro}</span>
                    ) : cap.pro ? (
                      <CheckCircle2 size={20} className="text-primary mx-auto fill-primary/10" />
                    ) : (
                      <span className="text-[11px] font-bold text-on-surface-variant/40 tracking-wider uppercase">not on plan</span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-center">
                    {cap.enterprise ? (
                      <CheckCircle2 size={20} className="text-primary mx-auto fill-primary" />
                    ) : (
                      <span className="text-[11px] font-bold text-on-surface-variant/40 tracking-wider uppercase">not on plan</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="bg-white border border-surface-container-high rounded-xl p-12 text-center max-w-3xl mx-auto shadow-sm">
          <Building2 className="text-primary mx-auto mb-4" size={40} />
          <h2 className="text-2xl font-bold text-on-surface mb-3">Looking for a custom solution?</h2>
          <p className="text-on-surface-variant mb-8 px-4">For organizations with specific compliance requirements, multi-tenant architectures, or volume exceeding 1M+ interactions monthly.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="bg-on-surface text-surface px-8 py-3 rounded-lg font-bold text-sm shadow-md hover:opacity-90 transition-opacity">Contact Sales for Custom</button>
            <button className="text-primary font-semibold text-sm px-8 py-3 hover:bg-surface-container-high rounded-lg transition-colors flex items-center gap-2">
              View SLA Documentation <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
