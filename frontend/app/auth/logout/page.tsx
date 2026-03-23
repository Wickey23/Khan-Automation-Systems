"use client";

import { useEffect } from "react";
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
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
        Signing out...
      </div>
    </div>
  );
}
