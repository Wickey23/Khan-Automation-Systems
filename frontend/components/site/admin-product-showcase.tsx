"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  MessageSquare,
  Search,
  Shield,
  Smartphone,
  Zap
} from "lucide-react";

const ADMIN_PAGES = [
  { id: "overview", label: "Overview", icon: Shield },
  { id: "orgs", label: "Organizations", icon: Building2 },
  { id: "health", label: "System Health", icon: Activity },
  { id: "reports", label: "Reports", icon: BarChart3 }
];

export function AdminProductShowcase() {
  const [activePageIndex, setActivePageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActivePageIndex((prev) => (prev + 1) % ADMIN_PAGES.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, []);

  const activePage = ADMIN_PAGES[activePageIndex];

  return (
    <div className="grid gap-24 lg:grid-cols-2 lg:items-center">
      <div className="relative order-2 lg:order-1">
        <div className="absolute -inset-10 rounded-[4rem] bg-[#3caff6]/20 blur-[100px] opacity-50" />
        <div className="relative z-10 overflow-hidden rounded-[3rem] border border-slate-800 bg-slate-950 shadow-2xl">
          <div className="flex min-h-[620px]">
            <div className="hidden w-48 shrink-0 border-r border-slate-800 bg-slate-950 p-6 lg:flex lg:flex-col lg:gap-8">
              <div className="flex items-center gap-2 px-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-white">
                  <Shield size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase leading-none tracking-tight text-white">Front Desk OS</span>
                  <span className="mt-1 text-[8px] font-bold uppercase tracking-widest text-primary">Admin Console</span>
                </div>
              </div>
              <nav className="space-y-1">
                {ADMIN_PAGES.map((page) => (
                  <div
                    key={page.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10px] font-bold transition-all ${
                      activePage.id === page.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <page.icon size={16} />
                    <span>{page.label}</span>
                  </div>
                ))}
              </nav>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                  <div className="h-8 w-full rounded-lg border border-slate-800 bg-slate-900 pl-8" />
                </div>
                <div className="flex items-center gap-3">
                  <Bell size={14} className="text-slate-500" />
                  <div className="h-6 w-6 rounded-full bg-slate-800" />
                </div>
              </div>

              <div className="relative flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activePage.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 p-6"
                  >
                    {activePage.id === "overview" && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: "Total Orgs", val: "142", trend: "+4" },
                            { label: "Active Calls", val: "18", trend: "Live" },
                            { label: "Success", val: "98.4%", trend: "+0.2%" }
                          ].map((card) => (
                            <div key={card.label} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{card.label}</span>
                              <div className="flex items-baseline justify-between">
                                <span className="text-xl font-black text-white">{card.val}</span>
                                <span className={`text-[8px] font-bold ${card.trend === "Live" ? "text-primary" : "text-emerald-500"}`}>
                                  {card.trend}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white">System Load</span>
                            <Activity size={14} className="text-primary" />
                          </div>
                          <div className="flex h-20 items-end gap-1">
                            {[40, 60, 45, 70, 55, 80, 65, 90, 75, 85, 60, 50].map((height, index) => (
                              <div key={index} className="relative flex-1 rounded-t-sm bg-primary/20">
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: `${height}%` }}
                                  className="absolute inset-x-0 bottom-0 rounded-t-sm bg-primary"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activePage.id === "orgs" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white">Active Organizations</h3>
                          <div className="flex h-8 w-24 items-center justify-center rounded-lg bg-primary text-[8px] font-bold uppercase tracking-widest text-white">
                            Add New
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
                          <div className="divide-y divide-slate-800">
                            {[
                              { name: "Acme Medical Group", status: "Active" },
                              { name: "Global Logistics Inc", status: "Active" },
                              { name: "City Dental Center", status: "Provisioning" }
                            ].map((org) => (
                              <div key={org.name} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-slate-400">
                                    <Building2 size={12} />
                                  </div>
                                  <span className="text-[10px] font-bold text-white">{org.name}</span>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[7px] font-bold uppercase tracking-widest ${
                                    org.status === "Active" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                                  }`}
                                >
                                  {org.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activePage.id === "health" && (
                      <div className="space-y-6">
                        <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Global Latency</span>
                            <div className="flex gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-500">Healthy</span>
                            </div>
                          </div>
                          <div className="flex h-24 items-center justify-center">
                            <svg className="h-full w-full" viewBox="0 0 400 100">
                              <motion.path
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 2, repeat: Infinity }}
                                d="M0,50 Q50,20 100,50 T200,50 T300,50 T400,50"
                                fill="none"
                                stroke="#3caff6"
                                strokeWidth="2"
                              />
                              <path d="M0,50 Q50,20 100,50 T200,50 T300,50 T400,50" fill="none" stroke="#3caff6" strokeOpacity="0.2" strokeWidth="2" />
                            </svg>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {["API Gateway", "LLM Engine"].map((service) => (
                            <div key={service} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                              <span className="text-[9px] font-bold text-slate-300">{service}</span>
                              <CheckCircle2 size={10} className="text-emerald-500" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activePage.id === "reports" && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white">Analytics</h3>
                          <div className="flex h-8 w-20 items-center justify-center rounded-lg bg-primary text-[8px] font-bold uppercase tracking-widest text-white">
                            Export
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-white">Call Resolution</span>
                            <div className="relative mx-auto h-20 w-20">
                              <svg className="h-full w-full -rotate-90 transform">
                                <circle cx="40" cy="40" r="30" fill="none" stroke="#1e293b" strokeWidth="8" />
                                <motion.circle
                                  initial={{ strokeDasharray: "0 188" }}
                                  animate={{ strokeDasharray: "150 188" }}
                                  cx="40"
                                  cy="40"
                                  r="30"
                                  fill="none"
                                  stroke="#3caff6"
                                  strokeLinecap="round"
                                  strokeWidth="8"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-black text-white">84%</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-white">Revenue Impact</span>
                            <div className="flex h-20 items-end gap-1">
                              {[30, 45, 35, 60, 50, 75].map((height, index) => (
                                <div
                                  key={index}
                                  className="flex-1 rounded-t-sm border-t border-primary/60 bg-primary/40"
                                  style={{ height: `${height}%` }}
                                />
                              ))}
                            </div>
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

      <div className="order-1 space-y-8 lg:order-2">
        <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
          A workspace built for <span className="font-serif italic text-primary">operational clarity.</span>
        </h2>
        <p className="text-xl leading-relaxed text-slate-400">
          Monitor every conversation, review AI summaries, and jump in whenever you need to. Front Desk OS gives you full control without the noise.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            { icon: Smartphone, title: "Mobile Ready", desc: "Manage your front desk from anywhere." },
            { icon: MessageSquare, title: "Live Transcripts", desc: "Read calls as they happen." },
            { icon: Calendar, title: "Instant Booking", desc: "See appointments in real-time." },
            { icon: Zap, title: "Smart Alerts", desc: "Get notified of high-value leads." }
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="space-y-2">
              <div className="text-primary">
                <Icon size={20} />
              </div>
              <h4 className="font-bold text-white">{title}</h4>
              <p className="text-sm font-medium text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
