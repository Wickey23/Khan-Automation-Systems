import React from 'react';
import { 
  CreditCard, 
  Check, 
  ArrowUpRight, 
  Download, 
  ShieldCheck, 
  Zap, 
  Clock, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Billing: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-12 bg-background-light">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Billing & Subscription</h1>
          <p className="text-slate-500 mt-2">Manage your plan, payment methods, and view your billing history.</p>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-12">
          {/* Current Plan Card */}
          <div className="col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Current Plan</h3>
                  <p className="text-2xl font-extrabold text-primary">Professional Plan</p>
                </div>
              </div>
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                Change Plan
              </button>
            </div>
            <div className="p-8 flex-1 grid grid-cols-2 gap-12">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Plan Features</h4>
                <ul className="space-y-3">
                  {['Unlimited AI Calls', 'Advanced Lead Routing', 'Custom SMS Sequences', 'Team Collaboration', 'Priority Support'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <Check size={12} />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Usage This Month</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-600">AI Call Minutes</span>
                        <span className="text-slate-900">1,284 / 5,000</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: '25%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-600">SMS Messages</span>
                        <span className="text-slate-900">456 / 1,000</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: '45.6%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">Next billing date: <span className="font-bold text-slate-900">April 12, 2026</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Payment Method</h3>
            </div>
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50 relative overflow-hidden group hover:border-primary/30 transition-all cursor-pointer">
                <div className="absolute -top-6 -right-6 h-24 w-24 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-all"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <CreditCard size={32} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded">Default</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 tracking-widest">•••• •••• •••• 4242</p>
                  <div className="flex justify-between mt-4">
                    <span className="text-xs text-slate-500 font-medium uppercase">Sameer Kumar</span>
                    <span className="text-xs text-slate-500 font-medium">12 / 28</span>
                  </div>
                </div>
              </div>
              <button className="w-full mt-6 flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                <Plus size={18} />
                Add New Card
              </button>
            </div>
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Billing History</h3>
            <button className="text-sm font-bold text-primary hover:underline">View All Invoices</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-8 py-4">Invoice ID</th>
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Amount</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { id: 'INV-2026-003', date: 'Mar 12, 2026', amount: '$249.00', status: 'Paid' },
                  { id: 'INV-2026-002', date: 'Feb 12, 2026', amount: '$249.00', status: 'Paid' },
                  { id: 'INV-2026-001', date: 'Jan 12, 2026', amount: '$249.00', status: 'Paid' },
                ].map((inv, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-4 text-sm font-bold text-slate-900">{inv.id}</td>
                    <td className="px-8 py-4 text-sm text-slate-600">{inv.date}</td>
                    <td className="px-8 py-4 text-sm font-bold text-slate-900">{inv.amount}</td>
                    <td className="px-8 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold uppercase">
                        <Check size={12} />
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                        <Download size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
