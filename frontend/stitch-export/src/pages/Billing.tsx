import React from 'react';
import { 
  CreditCard, 
  Zap, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Download,
  Plus,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const invoices = [
  { id: 'INV-2024-001', date: 'Oct 01, 2024', amount: '$149.00', status: 'paid' },
  { id: 'INV-2024-002', date: 'Sep 01, 2024', amount: '$149.00', status: 'paid' },
  { id: 'INV-2024-003', date: 'Aug 01, 2024', amount: '$149.00', status: 'paid' },
  { id: 'INV-2024-004', date: 'Jul 01, 2024', amount: '$149.00', status: 'paid' },
];

export default function BillingPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">Account Billing</h1>
        <p className="text-on-surface-variant text-sm">Manage your subscription, payment methods, and usage.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-on-surface">Current Plan</h2>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded uppercase tracking-wider">Active</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-surface-container-low rounded-xl border border-outline-variant/10">
              <div>
                <h3 className="text-2xl font-extrabold text-on-surface">Pro Plan</h3>
                <p className="text-sm text-on-surface-variant mt-1">Billed monthly • Next billing date: Nov 01, 2024</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-on-surface">$149.00</div>
                <button className="text-xs font-bold text-primary hover:underline mt-1">Change Plan</button>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">AI Usage Metrics</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-on-surface-variant">Voice Minutes</span>
                    <span className="text-on-surface">482 / 1,000</span>
                  </div>
                  <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full w-[48.2%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-on-surface-variant">SMS Follow-ups</span>
                    <span className="text-on-surface">1,240 / Unlimited</span>
                  </div>
                  <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full w-[100%]"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-on-surface">Payment Method</h2>
              <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                <Plus size={14} /> Add New
              </button>
            </div>

            <div className="relative h-48 w-80 primary-gradient rounded-2xl p-6 text-white shadow-xl shadow-primary/20 overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform">
                <CreditCard size={120} />
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <div className="text-sm font-bold tracking-widest">VISA</div>
                  <div className="w-10 h-8 bg-white/20 rounded-md"></div>
                </div>
                <div>
                  <div className="text-lg font-mono tracking-[0.2em] mb-2">•••• •••• •••• 4242</div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-[10px] uppercase opacity-60 mb-0.5">Card Holder</div>
                      <div className="text-xs font-bold">ALEX THOMPSON</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase opacity-60 mb-0.5">Expires</div>
                      <div className="text-xs font-bold">12/26</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/10">
            <h2 className="text-lg font-bold text-on-surface mb-8">Billing History</h2>
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl hover:bg-surface-container transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-on-surface-variant border border-outline-variant/10">
                      <History size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-on-surface">{invoice.id}</div>
                      <div className="text-[11px] text-on-surface-variant">{invoice.date}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-on-surface">{invoice.amount}</div>
                    <button className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 justify-end">
                      <Download size={12} /> PDF
                    </button>
                  </div>
                </div>
              ))}
              <button className="w-full py-3 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors">View All Invoices</button>
            </div>
          </section>

          <section className="bg-surface-container-high rounded-2xl p-8 border border-white/40">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface mb-2">Need more minutes?</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-4">You've used 48% of your monthly voice minutes. Upgrade to Enterprise for unlimited access.</p>
                <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  View Enterprise Pricing <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
