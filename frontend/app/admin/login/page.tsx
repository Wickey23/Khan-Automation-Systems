import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const metadata: Metadata = {
  title: "Admin Login"
};

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,214,0.16),transparent_34%),linear-gradient(180deg,#f7fbff_0%,#edf4fd_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div className="space-y-4">
            <p className="inline-flex w-fit rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              Admin Control Plane
            </p>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Secure platform operations access
            </h1>
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              Sign in to manage tenants, reliability diagnostics, billing telemetry, and global automation controls.
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white/95 p-6 shadow-[0_30px_60px_-36px_rgba(15,23,42,0.5)]">
            <AdminLoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}

