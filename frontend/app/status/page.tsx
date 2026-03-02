"use client";

import { useEffect, useState } from "react";
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
    <div className="container py-12">
      <h1 className="text-3xl font-bold">System Status</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Live operational snapshot for voice, messaging, billing, and webhooks.
      </p>

      <div className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall</p>
            <p className="mt-1 text-2xl font-semibold">
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
          <p className="mt-2 text-xs text-muted-foreground">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["voice", "sms", "billing", "webhooks"] as const).map((key) => {
          const componentStatus = data?.components?.[key] || "DEGRADED";
          return (
            <div key={key} className="rounded-lg border bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{key}</p>
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
