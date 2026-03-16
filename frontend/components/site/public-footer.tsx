import Link from "next/link";
import { PhoneCall } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-24">
      <div className="mx-auto grid max-w-7xl gap-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3caff6]">
              <PhoneCall className="text-white" size={18} />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-xl font-black leading-none tracking-tight text-slate-900">
                Front Desk <span className="text-[#3caff6]">OS</span>
              </span>
              <span className="ml-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                by Khan Systems
              </span>
            </div>
          </Link>
          <p className="text-sm leading-relaxed text-slate-500">
            The AI-powered front desk for modern service businesses. Never miss a lead, never lose a customer.
          </p>
        </div>

        <div>
          <h4 className="mb-8 text-xs font-bold uppercase tracking-widest text-slate-900">Product</h4>
          <ul className="space-y-4 text-sm font-medium text-slate-500">
            <li><Link href="/how-it-works" className="hover:text-[#3caff6]">How It Works</Link></li>
            <li><Link href="/#features" className="hover:text-[#3caff6]">Features</Link></li>
            <li><Link href="/#pricing" className="hover:text-[#3caff6]">Pricing</Link></li>
            <li><Link href="/contact" className="hover:text-[#3caff6]">Contact Sales</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-8 text-xs font-bold uppercase tracking-widest text-slate-900">Legal &amp; Support</h4>
          <ul className="space-y-4 text-sm font-medium text-slate-500">
            <li><Link href="/privacy" className="hover:text-[#3caff6]">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-[#3caff6]">Terms of Service</Link></li>
            <li><Link href="/contact" className="hover:text-[#3caff6]">Support</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-8 text-xs font-bold uppercase tracking-widest text-slate-900">Newsletter</h4>
          <p className="mb-6 text-sm font-medium text-slate-500">Get the latest on AI operations.</p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Email"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition-all focus:border-[#3caff6]"
            />
            <button className="rounded-xl bg-[#3caff6] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-200">
              Join
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-24 max-w-7xl border-t border-slate-100 pt-8 text-center">
        <p className="text-xs font-medium text-slate-400">&copy; 2026 Front Desk OS by Khan Systems. All rights reserved.</p>
      </div>
    </footer>
  );
}
