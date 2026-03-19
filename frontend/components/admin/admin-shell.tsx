"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Bell, Building2, History, LayoutDashboard, LogOut, MessageSquare, Monitor, PhoneCall, Search, Shield, Users } from "lucide-react";
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

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f8]">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center gap-3 px-2">
            <div className="flex items-center justify-center rounded-xl bg-primary p-2 text-white shadow-lg shadow-sky-500/20">
              <Shield className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-extrabold leading-none tracking-tight text-white">Front Desk OS</h1>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primary">Admin Console</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = pathname === item.path || (item.path !== "/admin" && pathname.startsWith(`${item.path}/`));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all",
                    active ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      active ? "text-white" : "text-slate-500 group-hover:text-white"
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-800 p-6">
          <Link
            href="/admin/orgs"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-black/20 transition-all hover:bg-slate-700"
          >
            <Shield className="h-4 w-4" />
            <span>System Action</span>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-8">
          <div className="flex max-w-xl flex-1 items-center gap-4">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                readOnly
                value=""
                placeholder="Search system logs, orgs, or events..."
                className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-800 hover:text-white">
              <Bell className="h-5 w-5" />
              <div className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-slate-900 bg-red-500" />
            </button>
            <button className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-800 hover:text-white">
              <MessageSquare className="h-5 w-5" />
            </button>
            <div className="mx-1 h-8 w-px bg-slate-800" />
            <div className="hidden items-center gap-3 pl-2 sm:flex">
              <div className="text-right">
                <p className="text-sm font-bold leading-none text-white">{user?.email?.split("@")[0] || "Admin User"}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {user?.role === "SUPER_ADMIN" ? "Super Admin" : user?.role?.replaceAll("_", " ") || "Admin"}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200">
                {(user?.email?.[0] || "A").toUpperCase()}
              </div>
              <Link
                href="/auth/logout"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-200 transition-all hover:bg-slate-700 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-end justify-between gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
                <div>
                  <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                    <Shield className="h-3.5 w-3.5" />
                    Global Control Plane
                  </p>
                  <h1 className="mt-2 text-[30px] font-black tracking-[-0.04em]">{pageLabel}</h1>
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
