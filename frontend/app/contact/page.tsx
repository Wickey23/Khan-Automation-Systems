import type { Metadata } from "next";
import { Calendar, Mail, MessageSquare, Phone, Send, ShieldCheck } from "lucide-react";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicNav } from "@/components/site/public-nav";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to Front Desk OS by Khan Systems about demos, sales, support, and implementation."
};

const contactItems = [
  [Calendar, "Book a Demo", "See Front Desk OS in action with a walkthrough of the operator workspace and rollout model."],
  [MessageSquare, "Sales Inquiries", "Questions about pricing, multi-location setups, or custom implementation."],
  [ShieldCheck, "Support & Setup", "Existing partners needing technical support or onboarding guidance."]
] as const;

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#f5f7f8] font-sans text-slate-900">
      <PublicNav />
      <main className="px-6 pb-24 pt-32">
        <div className="mx-auto grid max-w-7xl items-start gap-24 lg:grid-cols-2">
          <div className="space-y-12">
            <div>
              <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-slate-900">
                Let&apos;s talk about your <br />
                <span className="font-serif italic text-[#3caff6]">front desk operations.</span>
              </h1>
              <p className="max-w-lg text-xl leading-relaxed text-slate-500">
                Whether you want a demo, a pricing conversation, or implementation guidance, this is the right place to start.
              </p>
            </div>

            <div className="space-y-8">
              {contactItems.map(([Icon, title, copy]) => (
                <div key={title} className="flex gap-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#3caff6]">
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className="mb-1 text-lg font-bold text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-500">{copy}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Direct Contact</p>
              <div className="space-y-2">
                <p className="flex items-center gap-3 font-bold text-slate-700">
                  <Mail size={18} className="text-[#3caff6]" />
                  hello@khansystems.com
                </p>
                <p className="flex items-center gap-3 font-bold text-slate-700">
                  <Phone size={18} className="text-[#3caff6]" />
                  hello@khansystems.com
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-2xl">
            <form className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Full Name</label>
                  <input type="text" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#3caff6]" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Work Email</label>
                  <input type="email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#3caff6]" placeholder="john@business.com" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Business Name</label>
                <input type="text" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#3caff6]" placeholder="Acme Services" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Inquiry Type</label>
                <select className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#3caff6]">
                  <option>Book a Demo</option>
                  <option>Sales Inquiry</option>
                  <option>Support & Implementation</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Message</label>
                <textarea className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#3caff6]" placeholder="Tell us about your operations..." />
              </div>

              <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3caff6] py-4 font-bold text-white shadow-xl shadow-sky-200 transition-all hover:bg-sky-500">
                Send Message
                <Send size={18} />
              </button>

              <p className="text-center text-[10px] font-medium leading-relaxed text-slate-400">
                By submitting this form, you agree to our <a href="/privacy" className="text-[#3caff6] hover:underline">Privacy Policy</a> and{" "}
                <a href="/terms" className="text-[#3caff6] hover:underline">Terms of Service</a>.
              </p>
            </form>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
