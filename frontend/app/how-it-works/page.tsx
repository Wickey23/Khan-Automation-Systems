import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageSquare, Phone, Settings, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicNav } from "@/components/site/public-nav";

export const metadata: Metadata = {
  title: "How It Works",
  description: "See how Front Desk OS keeps your number, configures AI front desk logic, recovers missed calls, and gives staff an operator workspace."
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#f5f7f8] font-sans text-slate-900">
      <PublicNav />
      <main className="px-6 pb-24 pt-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-32 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#3caff6]">
              <Zap size={12} />
              The Process
            </div>
            <h1 className="mb-8 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
              From missed calls to <br />
              <span className="font-serif italic text-[#3caff6]">automated operations.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed text-slate-500">
              This is a structured operational rollout. We keep your number, configure business logic, recover missed calls,
              and give your team one workspace to operate from.
            </p>
          </div>

          <div className="mb-32 space-y-32">
            <div className="grid items-center gap-24 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="text-6xl font-black italic leading-none text-slate-100">01</div>
                <h2 className="text-4xl font-bold leading-tight text-slate-900">Keep your number. <br />Connect in minutes.</h2>
                <p className="text-lg leading-relaxed text-slate-500">
                  You do not need to change your business identity. Keep your existing number and set up forwarding to Front Desk OS.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3 font-bold text-slate-700"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-[#3caff6]"><Phone size={14} /></div>Works with standard business phone setups</li>
                  <li className="flex items-center gap-3 font-bold text-slate-700"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-[#3caff6]"><Smartphone size={14} /></div>5-10 minute technical setup</li>
                </ul>
              </div>
              <div className="rounded-[3rem] border border-slate-100 bg-white p-10 shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3caff6] text-white"><Phone size={20} /></div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Current Status</p>
                      <p className="text-sm font-bold text-slate-900">Forwarding Active</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-6">
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#3caff6]">Routing Logic</p>
                    <p className="text-sm leading-relaxed text-slate-600">If the call is unanswered after a short office ring window, it forwards to the Front Desk OS AI receptionist.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid items-center gap-24 lg:grid-cols-2">
              <div className="order-2 space-y-6 rounded-[3rem] bg-slate-900 p-10 shadow-2xl lg:order-1">
                <div className="flex items-center gap-3"><div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">AI Training in Progress</span></div>
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="mb-1 text-xs italic text-white/50">Prompt Instruction</p><p className="text-sm font-medium text-white">Always prioritize high-urgency customer issues and capture the exact location or service need immediately.</p></div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="mb-1 text-xs italic text-white/50">Booking Rule</p><p className="text-sm font-medium text-white">Offer only valid time windows and escalate requests that fall outside current business logic.</p></div>
                </div>
              </div>
              <div className="order-1 space-y-6 lg:order-2">
                <div className="text-6xl font-black italic leading-none text-slate-100">02</div>
                <h2 className="text-4xl font-bold leading-tight text-slate-900">Configure the AI <br />to your business logic.</h2>
                <p className="text-lg leading-relaxed text-slate-500">
                  Structured onboarding defines how the AI answers, what it captures, when it escalates, and how booking logic behaves.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="text-sm font-bold text-slate-900">Lead Capture</h4><p className="mt-2 text-xs text-slate-500">Name, phone, intent, urgency</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="text-sm font-bold text-slate-900">Booking</h4><p className="mt-2 text-xs text-slate-500">Calendar sync and availability rules</p></div>
                </div>
              </div>
            </div>

            <div className="grid items-center gap-24 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="text-6xl font-black italic leading-none text-slate-100">03</div>
                <h2 className="text-4xl font-bold leading-tight text-slate-900">Missed-call recovery <br />via instant SMS.</h2>
                <p className="text-lg leading-relaxed text-slate-500">
                  If a caller hangs up before the AI answers, Front Desk OS sends an immediate text to recover the lead before they move on.
                </p>
                <div className="rounded-2xl border border-l-4 border-l-[#3caff6] border-slate-200 bg-white p-6"><p className="text-sm italic text-slate-600">&quot;Hi, this is Front Desk OS. Sorry we missed your call. How can we help you today?&quot;</p></div>
              </div>
              <div className="rounded-[3rem] border border-slate-100 bg-white p-10 shadow-2xl">
                <div className="space-y-8">
                  <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-tr-none bg-slate-100 p-4"><p className="text-sm font-medium text-slate-600">I need to book a cleaning for next Tuesday.</p></div></div>
                  <div className="flex justify-start"><div className="max-w-[80%] rounded-2xl rounded-tl-none bg-[#3caff6] p-4 text-white shadow-lg shadow-sky-200"><p className="text-sm font-medium">Got it. I see an opening at 2:00 PM. Should I reserve that for you?</p></div></div>
                </div>
              </div>
            </div>

            <div className="grid items-center gap-24 lg:grid-cols-2">
              <div className="order-2 space-y-6 rounded-[3rem] border border-slate-100 bg-white p-6 shadow-2xl lg:order-1">
                <div className="rounded-[2.5rem] border border-slate-200 bg-slate-50 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Workspace Preview</p><p className="text-lg font-bold text-slate-900">Operator Dashboard</p></div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">Live</span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-bold text-[#3caff6]">Calls</div>
                      <div className="px-3 py-2 text-sm font-medium text-slate-500">Leads</div>
                      <div className="px-3 py-2 text-sm font-medium text-slate-500">Messages</div>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">Urgent queue and follow-up actions</div>
                      <div className="rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">Transcript review and messaging context</div>
                      <div className="rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">Operator controls and admin visibility</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 space-y-6 lg:order-2">
                <div className="text-6xl font-black italic leading-none text-slate-100">04</div>
                <h2 className="text-4xl font-bold leading-tight text-slate-900">Operator workspace <br />and admin control.</h2>
                <p className="text-lg leading-relaxed text-slate-500">
                  Review transcripts, listen to recordings, message leads, and step in whenever a human touch is needed.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3 font-bold text-slate-700"><ShieldCheck size={18} className="text-[#3caff6]" />Live call transcripts and summaries</li>
                  <li className="flex items-center gap-3 font-bold text-slate-700"><MessageSquare size={18} className="text-[#3caff6]" />Unified inbox for SMS and calls</li>
                  <li className="flex items-center gap-3 font-bold text-slate-700"><Settings size={18} className="text-[#3caff6]" />Real-time AI instruction updates</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[4rem] bg-slate-900 p-16 text-center md:p-24">
            <div className="relative z-10 mx-auto max-w-3xl space-y-10">
              <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl">Ready for a disciplined <br /><span className="font-serif italic text-[#3caff6]">operational rollout?</span></h2>
              <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
                <Link href="/contact" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3caff6] px-10 py-5 text-lg font-bold text-white shadow-2xl shadow-sky-500/30 transition-all hover:bg-sky-500 sm:w-auto">Get Started Now<ArrowRight size={20} /></Link>
                <Link href="/contact" className="inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-10 py-5 text-lg font-bold text-white transition-all hover:bg-white/20 sm:w-auto">Talk to Sales</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
