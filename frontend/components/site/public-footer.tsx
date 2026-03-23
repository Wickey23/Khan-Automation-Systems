import Link from "next/link";
import { PhoneCall } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/80 px-6 py-24 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 text-white">
              <PhoneCall size={18} />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-xl font-black leading-none tracking-tight text-slate-900">
                Front Desk <span className="text-sky-600">OS</span>
              </span>
              <span className="ml-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">by Khan Systems</span>
            </div>
          </Link>
          <p className="text-sm leading-relaxed text-slate-600">
            The AI-powered front desk for modern service businesses. Never miss a lead, never lose a customer.
          </p>
        </div>

        <div>
          <h4 className="mb-8 text-xs font-bold uppercase tracking-widest text-slate-900">Product</h4>
          <ul className="space-y-4 text-sm font-medium text-slate-600">
            <li><Link href="/how-it-works" className="hover:text-sky-700">How It Works</Link></li>
            <li><Link href="/#features" className="hover:text-sky-700">Features</Link></li>
            <li><Link href="/#pricing" className="hover:text-sky-700">Pricing</Link></li>
            <li><Link href="/contact" className="hover:text-sky-700">Contact Sales</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-8 text-xs font-bold uppercase tracking-widest text-slate-900">Legal &amp; Support</h4>
          <ul className="space-y-4 text-sm font-medium text-slate-600">
            <li><Link href="/privacy" className="hover:text-sky-700">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-sky-700">Terms of Service</Link></li>
            <li><Link href="/contact" className="hover:text-sky-700">Support</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-8 text-xs font-bold uppercase tracking-widest text-slate-900">Newsletter</h4>
          <p className="mb-6 text-sm font-medium text-slate-600">Get the latest on AI operations.</p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Email"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-colors focus:border-sky-400"
            />
            <button className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_20px_-12px_rgba(14,116,214,0.9)]">
              Join
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-24 max-w-7xl border-t border-slate-200 pt-8 text-center">
        <p className="text-xs font-medium text-slate-500">&copy; 2026 Front Desk OS by Khan Systems. All rights reserved.</p>
      </div>
    </footer>
  );
}
