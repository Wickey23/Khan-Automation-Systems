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
      <div className="absolute -inset-4 rounded-[3rem] bg-[#3caff6]/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl">
        <div className="flex min-h-[620px]">
          <div className="hidden w-48 shrink-0 border-r border-slate-100 bg-white p-6 lg:flex lg:flex-col lg:gap-8">
            <div className="flex items-center gap-2 px-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3caff6] text-white">
                <ConciergeBell size={14} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight text-slate-900">Front Desk OS</span>
            </div>
            <nav className="space-y-1">
              {TOUR_PAGES.map((page) => (
                <div
                  key={page.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[10px] font-bold transition-all ${
                    activePage.id === page.id ? "bg-[#3caff6] text-white shadow-lg shadow-sky-200" : "text-slate-400"
                  }`}
                >
                  <page.icon size={16} />
                  <span>{page.label}</span>
                </div>
              ))}
            </nav>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/50">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6">
              <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-1.5">
                <Search size={12} className="text-slate-400" />
                <div className="h-2 w-24 rounded bg-slate-200" />
              </div>
              <div className="flex items-center gap-3">
                <Bell size={14} className="text-slate-400" />
                <div className="h-6 w-6 rounded-full bg-slate-200" />
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
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { label: "Calls", val: "1,284", trend: "+12%" },
                          { label: "Leads", val: "456", trend: "+5%" },
                          { label: "Bookings", val: "89", trend: "+8%" }
                        ].map((card) => (
                          <div key={card.label} className="space-y-2 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{card.label}</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-black text-slate-900">{card.val}</span>
                              <span className="text-[8px] font-bold text-emerald-500">{card.trend}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
                        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <span className="text-[10px] font-bold text-slate-900">Action Needed</span>
                            <div className="h-2 w-8 rounded bg-slate-100" />
                          </div>
                          <div className="space-y-3 p-4">
                            {["Urgent callback", "Booking confirmation", "SMS follow-up"].map((row) => (
                              <div key={row} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-6 w-6 rounded-full bg-slate-100" />
                                  <div className="space-y-1">
                                    <div className="h-2 w-20 rounded bg-slate-200" />
                                    <div className="h-1.5 w-16 rounded bg-slate-100" />
                                  </div>
                                </div>
                                <div className="h-5 w-14 rounded-lg bg-primary/10" />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                          <div className="mb-4 flex items-center justify-between border-b border-slate-50 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[#3caff6]">
                                <PhoneCall size={14} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Review</p>
                                <p className="text-base font-bold text-slate-900">Sarah J. Mason</p>
                              </div>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-emerald-700">
                              Completed
                            </span>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">AI Summary</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  Caller asked for Saturday morning availability and confirmed requirements before requesting a booking hold.
                                </p>
                              </div>
                              <div className="space-y-3">
                                <div className="flex gap-2">
                                  <div className="mt-1 h-4 w-4 rounded-full bg-slate-100" />
                                  <div className="w-full rounded-xl rounded-tl-none bg-slate-50 p-3 text-sm text-slate-600">
                                    Hi, do you have anything open this Saturday morning for a deep clean?
                                  </div>
                                </div>
                                <div className="flex flex-row-reverse gap-2">
                                  <div className="mt-1 h-4 w-4 rounded-full bg-primary/10" />
                                  <div className="w-full rounded-xl rounded-tr-none bg-primary/5 p-3 text-sm text-slate-700">
                                    Yes, I can hold a 10:00 AM slot and send a confirmation right after this call.
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="rounded-2xl border border-slate-200 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Intent</p>
                                <p className="mt-2 text-sm font-bold text-slate-900">Booking Request</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Channel</p>
                                <p className="mt-2 text-sm font-bold text-slate-900">Call + SMS</p>
                              </div>
                              <div className="rounded-2xl bg-slate-900 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Next Action</p>
                                <div className="mt-3 space-y-2">
                                  <div className="rounded-xl bg-[#3caff6] px-3 py-2 text-center text-sm font-bold text-white">Call Back</div>
                                  <div className="rounded-xl bg-white/10 px-3 py-2 text-center text-sm font-bold text-white">Send SMS</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activePage.id === "calls" && (
                    <div className="flex h-full gap-4">
                      <div className="w-1/3 space-y-3">
                        <div className="mb-4 h-2 w-12 rounded bg-slate-200" />
                        {[
                          { name: "Sarah J.", status: "In Call", active: true },
                          { name: "Michael C.", status: "Completed", active: false },
                          { name: "David M.", status: "Missed", active: false }
                        ].map((call) => (
                          <div
                            key={call.name}
                            className={`rounded-xl border p-3 ${
                              call.active ? "border-primary bg-white shadow-sm" : "border-transparent bg-transparent opacity-50"
                            }`}
                          >
                            <div className="mb-2 h-2 w-16 rounded bg-slate-900/10" />
                            <div className="flex items-center gap-1">
                              <div className={`h-1 w-1 rounded-full ${call.status === "In Call" ? "bg-emerald-500" : "bg-slate-300"}`} />
                              <span className="text-[8px] font-bold uppercase text-slate-400">{call.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-1 gap-4">
                        <div className="flex-1 space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <PhoneCall size={14} />
                              </div>
                              <div className="h-2 w-24 rounded bg-slate-900/10" />
                            </div>
                            <div className="h-4 w-16 rounded-full bg-emerald-50" />
                          </div>
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <div className="h-4 w-4 shrink-0 rounded-full bg-slate-100" />
                              <div className="h-8 w-full rounded-lg rounded-tl-none bg-slate-50" />
                            </div>
                            <div className="flex flex-row-reverse gap-2">
                              <div className="h-4 w-4 shrink-0 rounded-full bg-primary/10" />
                              <div className="h-8 w-full rounded-lg rounded-tr-none bg-primary/5" />
                            </div>
                          </div>
                          <div className="mt-4 space-y-2 rounded-xl bg-slate-900 p-3">
                            <div className="flex items-center gap-1">
                              <Zap size={10} className="text-primary" />
                              <span className="text-[8px] font-bold uppercase tracking-widest text-white">AI Intent</span>
                            </div>
                            <div className="h-1.5 w-full rounded bg-white/10" />
                          </div>
                        </div>

                        <div className="w-52 space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Follow-up</p>
                            <p className="mt-2 text-sm font-bold text-slate-900">Saturday morning request</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
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
