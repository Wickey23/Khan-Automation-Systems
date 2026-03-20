"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Filter, Search } from "lucide-react";
import { fetchOrgCalls } from "@/lib/api";
import type { OrgCallRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StateCard } from "@/components/stitch/components/app/StateCard";
import { StatusBadge } from "@/components/stitch/components/app/StatusBadge";

const OUTCOME_OPTIONS: Array<{ label: string; value: "" | OrgCallRecord["outcome"] }> = [
  { label: "All outcomes", value: "" },
  { label: "Appointment request", value: "APPOINTMENT_REQUEST" },
  { label: "Message taken", value: "MESSAGE_TAKEN" },
  { label: "Transferred", value: "TRANSFERRED" },
  { label: "Missed", value: "MISSED" },
  { label: "Abandoned", value: "ABANDONED" },
  { label: "Spam", value: "SPAM" }
];

function statusFromOutcome(outcome: OrgCallRecord["outcome"]): "answered" | "missed" {
  return outcome === "MISSED" || outcome === "ABANDONED" ? "missed" : "answered";
}

function formatDuration(value: number | null) {
  if (!value || value <= 0) return "0m 00s";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatAt(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function CallsPage() {
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState<"" | OrgCallRecord["outcome"]>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchOrgCalls({ page: 1, pageSize: 100, query: search || undefined, outcome: outcome || undefined })
      .then((payload) => {
        if (!mounted) return;
        setCalls(payload.calls || []);
      })
      .catch((reason) => {
        if (!mounted) return;
        setError(reason instanceof Error ? reason.message : "Unable to load calls.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [outcome, search]);

  const sortedCalls = useMemo(
    () => [...calls].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [calls]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Calls</h1>
          <p className="text-sm text-on-surface-variant">Inspect real call outcomes, transcripts, and recordings.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={16} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search calls..."
              className="w-64 rounded-xl border-none bg-surface-container-low py-2 pl-9 pr-4 text-sm outline-none ring-primary/20 focus:ring-2"
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant/70" size={14} />
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as "" | OrgCallRecord["outcome"])}
              className="rounded-xl border-none bg-surface-container-low py-2 pl-7 pr-3 text-sm font-medium text-on-surface outline-none ring-primary/20 focus:ring-2"
            >
              {OUTCOME_OPTIONS.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {loading ? <StateCard type="loading" title="Loading calls" description="Fetching latest call records." /> : null}
      {!loading && error ? <StateCard type="error" title="Calls unavailable" description={error} /> : null}
      {!loading && !error && sortedCalls.length === 0 ? (
        <StateCard type="empty" title="No calls yet" description="Inbound and outbound calls will appear once activity starts." />
      ) : null}

      {!loading && !error && sortedCalls.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">From / To</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Outcome</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Duration</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Started</th>
                  <th className="w-10 px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {sortedCalls.map((call) => {
                  const expanded = expandedId === call.id;
                  return (
                    <tr
                      key={call.id}
                      className={cn("cursor-pointer transition-colors hover:bg-surface-container-low/40", expanded && "bg-primary/5")}
                      onClick={() => setExpandedId(expanded ? null : call.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-on-surface">{call.fromNumber}</p>
                          <p className="text-xs text-on-surface-variant">to {call.toNumber}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge type="calls" state={statusFromOutcome(call.outcome)} />
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                          {call.outcome.replace(/_/g, " ")}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDuration(call.durationSec)}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{formatAt(call.startedAt)}</td>
                      <td className="px-6 py-4 text-right">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sortedCalls.map((call) => {
            if (expandedId !== call.id) return null;
            return (
              <div key={`expanded-${call.id}`} className="border-t border-primary/10 bg-primary/5 px-6 py-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-outline-variant/10 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Transcript / summary</p>
                    <p className="mt-3 text-sm leading-relaxed text-on-surface">
                      {call.transcript || call.summary || "Transcript is not available yet for this call."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-outline-variant/10 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Call artifacts</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-on-surface-variant">Status: {call.callStatus || call.dialCallStatus || "Unknown"}</p>
                      <p className="text-on-surface-variant">AI Provider: {call.aiProvider || "Unknown"}</p>
                      {call.recordingUrl ? (
                        <a
                          href={call.recordingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          Open recording <ExternalLink size={14} />
                        </a>
                      ) : (
                        <p className="text-on-surface-variant">Recording unavailable for this call.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
