"use client";

import { useEffect } from "react";
import { Loader2, LogOut } from "lucide-react";
import { authLogout } from "@/lib/api";

export default function AuthLogoutPage() {
  useEffect(() => {
    void authLogout().finally(() => {
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    });
  }, []);

  return (
    <div className="relative min-h-[70vh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-14 sm:px-6">
      <div className="mx-auto w-full max-w-xl rounded-[24px] border border-slate-200/90 bg-white/95 p-7 shadow-[0_28px_52px_-36px_rgba(15,23,42,0.45)]">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white">
          <LogOut className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">Signing you out</h1>
        <p className="mt-2 text-sm text-slate-600">Closing your session and redirecting to the homepage.</p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          Processing logout...
        </p>
      </div>
    </div>
  );
}
