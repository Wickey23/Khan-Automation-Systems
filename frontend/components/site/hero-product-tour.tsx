"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ConciergeBell,
  LayoutDashboard,
  MessageSquare,
  PhoneCall,
  Search,
  Users,
  Zap
} from "lucide-react";

const TOUR_PAGES = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calls", label: "Calls", icon: PhoneCall },
  { id: "leads", label: "Leads", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare }
];

export function HeroProductTour() {
  const [activePageIndex, setActivePageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActivePageIndex((prev) => (prev + 1) % TOUR_PAGES.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const activePage = TOUR_PAGES[activePageIndex];

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[3rem] bg-sky-100/70 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2.75rem] border border-slate-200/80 bg-[#f8fbff] shadow-[0_30px_80px_rgba(148,163,184,0.18)]">
        <div className="flex min-h-[620px]">
          <div className="hidden w-56 shrink-0 border-r border-slate-200/70 bg-white/90 p-7 lg:flex lg:flex-col lg:gap-8">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3caff6] text-white shadow-sm">
                <ConciergeBell size={14} />
              </div>
              <span className="text-xs font-black uppercase tracking-tight text-slate-900">Front Desk OS</span>
            </div>
            <nav className="space-y-2">
              {TOUR_PAGES.map((page) => (
                <div
                  key={page.id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                    activePage.id === page.id
                      ? "bg-[#3caff6] text-white shadow-[0_12px_30px_rgba(60,175,246,0.28)]"
                      : "text-slate-400"
                  }`}
                >
                  <page.icon size={16} />
                  <span>{page.label}</span>
                </div>
              ))}
            </nav>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden bg-[#f8fbff]">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/80 px-7 backdrop-blur-sm">
              <div className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-2">
                <Search size={12} className="text-slate-400" />
                <div className="h-2.5 w-28 rounded-full bg-slate-200" />
              </div>
              <div className="flex items-center gap-3">
                <Bell size={14} className="text-slate-400" />
                <div className="h-8 w-8 rounded-full bg-slate-200" />
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePage.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 p-6"
                >
                  {activePage.id === "dashboard" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-5">
                        {[
                          { label: "Calls", val: "1,284", trend: "+12%" },
                          { label: "Leads", val: "456", trend: "+5%" },
                          { label: "Bookings", val: "89", trend: "+8%" }
                        ].map((card) => (
                          <div
                            key={card.label}
                            className="space-y-3 rounded-[1.6rem] border border-slate-200/80 bg-white px-6 py-7 shadow-[0_6px_20px_rgba(15,23,42,0.06)]"
                          >
                            <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-slate-400">{card.label}</span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-[2.05rem] font-black tracking-tight text-slate-900">{card.val}</span>
                              <span className="text-[10px] font-bold text-emerald-500">{card.trend}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-[1.8rem] border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                          <span className="text-base font-bold text-slate-900">Action Needed</span>
                          <div className="h-2.5 w-10 rounded-full bg-slate-100" />
                        </div>
                        <div className="space-y-5 p-6">
                          {[1, 2, 3].map((row) => (
                            <div key={row} className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="h-8 w-8 rounded-full bg-slate-100" />
                                <div className="space-y-2">
                                  <div className="h-2.5 w-28 rounded-full bg-slate-200" />
                                  <div className="h-2 w-16 rounded-full bg-slate-100" />
                                </div>
                              </div>
                              <div className="h-7 w-16 rounded-xl bg-sky-50" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activePage.id === "calls" && (
                    <div className="flex h-full gap-5">
                      <div className="w-[32%] space-y-4 rounded-[1.7rem] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                        <div className="h-2 w-16 rounded-full bg-slate-200" />
                        {[
                          { name: "Sarah J.", status: "In Call", active: true },
                          { name: "Michael C.", status: "Completed", active: false },
                          { name: "David M.", status: "Missed", active: false }
                        ].map((call) => (
                          <div
                            key={call.name}
                            className={`rounded-2xl border px-4 py-4 ${
                              call.active ? "border-sky-200 bg-sky-50/70 shadow-sm" : "border-slate-100 bg-slate-50/50"
                            }`}
                          >
                            <div className="mb-3 h-2.5 w-20 rounded-full bg-slate-200" />
                            <div className="flex items-center gap-2">
                              <div className={`h-1.5 w-1.5 rounded-full ${call.status === "In Call" ? "bg-emerald-500" : "bg-slate-300"}`} />
                              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{call.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-1 gap-4">
                        <div className="flex-1 space-y-4 rounded-[1.7rem] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-primary">
                                <PhoneCall size={14} />
                              </div>
                              <div className="h-2.5 w-28 rounded-full bg-slate-200" />
                            </div>
                            <div className="h-5 w-16 rounded-full bg-emerald-50" />
                          </div>
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <div className="h-4 w-4 shrink-0 rounded-full bg-slate-100" />
                              <div className="h-10 w-full rounded-2xl rounded-tl-none bg-slate-50" />
                            </div>
                            <div className="flex flex-row-reverse gap-2">
                              <div className="h-4 w-4 shrink-0 rounded-full bg-primary/10" />
                              <div className="h-10 w-full rounded-2xl rounded-tr-none bg-primary/5" />
                            </div>
                          </div>
                          <div className="mt-4 space-y-2 rounded-2xl bg-slate-900 p-4">
                            <div className="flex items-center gap-1">
                              <Zap size={10} className="text-primary" />
                              <span className="text-[8px] font-bold uppercase tracking-widest text-white">AI Intent</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-white/10" />
                          </div>
                        </div>

                        <div className="w-52 space-y-3 rounded-[1.7rem] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Follow-up</p>
                            <p className="mt-2 text-sm font-bold text-slate-900">Saturday morning request</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Recommended</p>
                            <p className="mt-2 text-sm text-slate-600">Hold the slot and confirm by SMS.</p>
                          </div>
                          <div className="space-y-2">
                            <div className="rounded-xl bg-[#3caff6] px-3 py-2 text-center text-sm font-bold text-white">Call Back</div>
                            <div className="rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-bold text-slate-700">Send SMS</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activePage.id === "leads" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-900">Qualified Leads</span>
                        <div className="h-6 w-20 rounded-lg bg-primary" />
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                        <div className="grid grid-cols-4 gap-4 border-b border-slate-100 bg-slate-50 p-3">
                          {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="h-1.5 w-12 rounded bg-slate-200" />
                          ))}
                        </div>
                        <div className="divide-y divide-slate-50">
                          {[
                            { name: "John Doe", status: "Urgent" },
                            { name: "Sarah Smith", status: "New" },
                            { name: "Tech Corp", status: "Pending" }
                          ].map((lead) => (
                            <div key={lead.name} className="grid grid-cols-4 items-center gap-4 p-4">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-slate-100" />
                                <div className="h-2 w-16 rounded bg-slate-900/10" />
                              </div>
                              <div className="h-2 w-12 rounded bg-slate-400/10" />
                              <div className={`h-5 w-12 rounded-full ${lead.status === "Urgent" ? "bg-red-50" : "bg-blue-50"}`} />
                              <div className="ml-auto h-6 w-16 rounded-lg bg-slate-100" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activePage.id === "messages" && (
                    <div className="flex h-full gap-4">
                      <div className="w-1/3 space-y-3">
                        <div className="mb-4 h-2 w-12 rounded bg-slate-200" />
                        {[1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className={`rounded-xl border p-3 ${
                              item === 1 ? "border-primary bg-white shadow-sm" : "border-transparent bg-transparent opacity-50"
                            }`}
                          >
                            <div className="mb-2 h-2 w-16 rounded bg-slate-900/10" />
                            <div className="h-1.5 w-full rounded bg-slate-100" />
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-3 border-b border-slate-50 p-4">
                          <div className="h-8 w-8 rounded-full bg-slate-100" />
                          <div className="h-2 w-24 rounded bg-slate-900/10" />
                        </div>
                        <div className="flex-1 space-y-4 p-4">
                          <div className="flex justify-end">
                            <div className="max-w-[80%] rounded-xl rounded-tr-none bg-slate-100 p-3">
                              <div className="mb-1 h-1.5 w-32 rounded bg-slate-300" />
                              <div className="h-1.5 w-24 rounded bg-slate-300" />
                            </div>
                          </div>
                          <div className="flex justify-start">
                            <div className="max-w-[80%] rounded-xl rounded-tl-none bg-primary p-3 text-white">
                              <div className="mb-1 h-1.5 w-32 rounded bg-white/30" />
                              <div className="h-1.5 w-24 rounded bg-white/30" />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 p-4">
                          <div className="h-8 flex-1 rounded-lg border border-slate-200 bg-white" />
                          <div className="h-8 w-8 rounded-lg bg-primary" />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
