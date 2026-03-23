"use client";

import { useEffect, useState } from "react";
import { Activity, CalendarClock, SignalHigh } from "lucide-react";
import { fetchPublicStatus } from "@/lib/api";
import type { PublicSystemStatus } from "@/lib/types";

function statusClass(status: "OPERATIONAL" | "DEGRADED") {
  return status === "OPERATIONAL"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-800 border-amber-200";
}

export default function StatusPage() {
  const [data, setData] = useState<PublicSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchPublicStatus()
      .then((next) => {
        if (!active) return;
        setData(next);
      })
      .catch(() => {
        if (!active) return;
        setData(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page-shell space-y-6">
      <div className="rounded-[28px] border border-slate-200/90 bg-[linear-gradient(160deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.84)_100%)] px-6 py-6 shadow-[0_26px_48px_-34px_rgba(15,23,42,0.45)] sm:px-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Platform reliability</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-slate-950">System status</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
          Live operational snapshot for voice, messaging, billing, and webhooks.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall</p>
            <p className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold">
              <Activity className="h-5 w-5 text-slate-500" />
              {loading ? "Checking..." : data?.status || "Unknown"}
            </p>
          </div>
          {data ? (
            <span className={`rounded-md border px-3 py-1 text-xs font-semibold ${statusClass(data.status)}`}>
              {data.status}
            </span>
          ) : null}
        </div>
        {data?.timestamp ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["voice", "sms", "billing", "webhooks"] as const).map((key) => {
          const componentStatus = data?.components?.[key] || "DEGRADED";
          return (
            <div key={key} className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.35)]">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <SignalHigh className="h-3.5 w-3.5" />
                {key}
              </p>
              <span className={`mt-2 inline-flex rounded border px-2 py-1 text-xs font-semibold ${statusClass(componentStatus)}`}>
                {loading ? "Checking..." : componentStatus}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
