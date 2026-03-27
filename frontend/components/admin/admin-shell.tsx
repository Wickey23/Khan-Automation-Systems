"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Monitor,
  PhoneCall,
  Search,
  Shield,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMe } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Building2, label: "Organizations", path: "/admin/orgs" },
  { icon: PhoneCall, label: "Calls", path: "/admin/calls" },
  { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
  { icon: Users, label: "Leads", path: "/admin/leads" },
  { icon: Shield, label: "Operations", path: "/admin/ops" },
  { icon: Activity, label: "System Health", path: "/admin/system" },
  { icon: History, label: "Events", path: "/admin/events" },
  { icon: BarChart3, label: "Reports", path: "/admin/reports" },
  { icon: Monitor, label: "Demo Sandbox", path: "/admin/demo" }
];

function currentLabel(pathname: string) {
  const match =
    navItems.find((item) => pathname === item.path || (item.path !== "/admin" && pathname.startsWith(`${item.path}/`))) || null;
  return match?.label || "Admin Console";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    void getMe()
      .then((data) => {
        if (!active) return;
        setUser(data.user);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const isLogin = pathname === "/admin/login";
  const pageLabel = useMemo(() => currentLabel(pathname), [pathname]);
  const adminRoleLabel = user?.role === "SUPER_ADMIN" ? "Super Admin" : user?.role?.replaceAll("_", " ") || "Admin";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.14),transparent_58%),linear-gradient(180deg,#eef3fb_0%,#e7eef8_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-r from-blue-200/25 via-transparent to-cyan-200/25" />

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-white/65 bg-[linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.98)_58%,rgba(2,6,23,0.98)_100%)] p-4 text-slate-100 xl:flex">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-500/30">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight">Front Desk OS</h1>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Admin Console</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1 rounded-2xl border border-slate-800/80 bg-slate-900/72 p-2.5 shadow-[0_18px_36px_-26px_rgba(0,0,0,0.6)]">
            {navItems.map((item) => {
              const active = pathname === item.path || (item.path !== "/admin" && pathname.startsWith(`${item.path}/`));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border px-2.5 py-2 text-sm font-semibold transition-all duration-200",
                    active
                      ? "border-sky-500/60 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_16px_26px_-14px_rgba(14,116,214,0.9)]"
                      : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/80 hover:text-white"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", active ? "text-white" : "text-slate-400 group-hover:text-sky-300")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t border-slate-800 pt-5">
          <Link
            href="/admin/orgs"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800"
          >
            <Shield className="h-4 w-4" />
            <span>System Action</span>
          </Link>
          <Link
            href="/auth/logout"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 border-b border-white/60 bg-white/78 px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="relative w-full max-w-xl lg:max-w-2xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                readOnly
                value=""
                placeholder="Search orgs, calls, messages, or events..."
                className="h-9 w-full rounded-xl border border-slate-200/80 bg-white/90 py-2 pl-10 pr-4 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-sky-300"
              />
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                aria-label="Open notifications"
                className="relative rounded-xl border border-slate-200/80 bg-white/90 p-2 text-slate-600 shadow-[0_10px_18px_-14px_rgba(15,23,42,0.4)] transition-colors hover:bg-slate-100 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <Bell className="h-5 w-5" />
                <div className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
              </button>
              <button
                aria-label="Open messages"
                className="rounded-xl border border-slate-200/80 bg-white/90 p-2 text-slate-600 shadow-[0_10px_18px_-14px_rgba(15,23,42,0.4)] transition-colors hover:bg-slate-100 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
              <div className="hidden h-8 w-px bg-slate-200 sm:block" />
              <div className="hidden items-center gap-3 sm:flex">
                <div className="text-right">
                  <p className="text-sm font-semibold leading-none text-slate-900">{user?.email?.split("@")[0] || "Admin User"}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {user?.role === "SUPER_ADMIN" ? "Super Admin" : user?.role?.replaceAll("_", " ") || "Admin"}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-100 text-xs font-bold text-slate-700 shadow-[0_10px_18px_-14px_rgba(15,23,42,0.45)]">
                  {(user?.email?.[0] || "A").toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 xl:hidden">
            {navItems.slice(0, 8).map((item) => {
              const active = pathname === item.path || (item.path !== "/admin" && pathname.startsWith(`${item.path}/`));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition",
                    active ? "border-sky-200 bg-sky-500 text-white" : "border-slate-200 bg-white/85 text-slate-600 hover:border-slate-300"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 sm:px-6 lg:px-8">
            <div className="mb-4 rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,#020617_0%,#0f172a_42%,#1e293b_100%)] p-4 text-white shadow-[0_24px_44px_-34px_rgba(15,23,42,0.82)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">
                    <Shield className="h-3.5 w-3.5" />
                    Global Control Plane
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">{pageLabel}</h1>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">
                  Secure Admin Session
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Signed in as</p>
                  <p className="mt-1 text-sm font-semibold text-white">{user?.email || "Loading user..."}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Role</p>
                  <p className="mt-1 text-sm font-semibold text-white">{adminRoleLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Navigation scope</p>
                  <p className="mt-1 text-sm font-semibold text-white">{navItems.length} control modules</p>
                </div>
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
