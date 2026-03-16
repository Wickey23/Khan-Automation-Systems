"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, PhoneCall, Search } from "lucide-react";
import { fetchOrgCalls, getMe, repopulateOrgCalls, updateLeadPipelineStage } from "@/lib/api";
import type { FrontDeskPriority, OrgCallRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClientStatusGrid } from "@/components/ui/client-module";
import { Input } from "@/components/ui/input";
import { PageHelpFab } from "@/components/ui/page";
import { clientBadgeClass } from "@/lib/client-badges";
import { connectedNumberProviderDetail, connectedNumberProviderLabel } from "@/lib/client-status-language";
import {
  frontDeskActionBadgeClass,
  frontDeskCardClass,
  frontDeskContextPanelClass,
  frontDeskEmptyStateClass,
  frontDeskLoadingCardClass,
  frontDeskMetricCardClass,
  frontDeskOutcomeSurfaceClass,
  frontDeskOutcomeBadgeMeta,
  frontDeskPriorityBadgeClass,
  frontDeskPriorityMeta,
  frontDeskWorkspaceCardClass,
  frontDeskSkeletonLineClass
} from "@/lib/front-desk-ui";

const callStateFilters = ["ALL", "needs_follow_up", "contacted", "booked", "closed", "spam"] as const;
type PipelineStage = "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED";

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatRelativeUpdate(value: Date | null) {
  if (!value) return "just now";
  const diffMs = Date.now() - value.getTime();
  const diffMin = Math.max(0, Math.round(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return value.toLocaleString();
}

function formatQueueDayHeading(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function callDayKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextAction(call: OrgCallRecord) {
  if (call.frontDesk?.recommendedAction) return call.frontDesk.recommendedAction;
  if (call.outcome === "MISSED" || call.outcome === "ABANDONED") return "Call this customer back.";
  if (call.outcome === "TRANSFERRED" && call.unansweredTransfer) return "Follow up because the transfer was not answered.";
  if (call.outcome === "TRANSFERRED") return "Confirm the transfer solved the issue.";
  if (call.outcome === "APPOINTMENT_REQUEST") return "Review the request and confirm scheduling.";
  if (!call.transcript) return "Open the call and add notes.";
  return "No immediate action needed.";
}

function getDispositionLabel(call: OrgCallRecord) {
  if (call.frontDesk?.followUpState === "needs_follow_up") return "Needs follow-up";
  if (call.frontDesk?.followUpState === "contacted") return "Contacted";
  if (call.frontDesk?.followUpState === "booked") return "Booked";
  if (call.frontDesk?.followUpState === "closed") return "Resolved";
  if (call.frontDesk?.followUpState === "spam") return "Spam";
  if (call.outcome === "APPOINTMENT_REQUEST") return "Request captured";
  if (call.outcome === "TRANSFERRED") return "Transferred";
  if (call.outcome === "MESSAGE_TAKEN") return "Follow-up sent";
  if (call.outcome === "ABANDONED") return "Abandoned";
  if (call.outcome === "MISSED") return "Needs review";
  if (call.outcome === "SPAM") return "Spam";
  return "Conversation";
}

function getDispositionTone(call: OrgCallRecord): "booking" | "success" | "automated" | "warning" | "neutral" {
  if (call.frontDesk?.frontDeskPriority === "urgent") return "warning";
  if (call.frontDesk?.frontDeskPriority === "high") return "warning";
  if (call.frontDesk?.followUpState === "booked") return "booking";
  if (call.frontDesk?.followUpState === "contacted") return "automated";
  if (call.outcome === "APPOINTMENT_REQUEST") return "booking";
  if (call.outcome === "TRANSFERRED") return "success";
  if (call.outcome === "MESSAGE_TAKEN") return "automated";
  if (call.outcome === "ABANDONED") return "warning";
  if (call.outcome === "MISSED") return "warning";
  return "neutral";
}

function outcomeLabel(outcome: OrgCallRecord["outcome"]) {
  if (outcome === "APPOINTMENT_REQUEST") return "Request captured";
  if (outcome === "MESSAGE_TAKEN") return "Message taken";
  if (outcome === "TRANSFERRED") return "Transferred";
  if (outcome === "ABANDONED") return "Abandoned";
  if (outcome === "MISSED") return "Missed call";
  if (outcome === "SPAM") return "Spam";
  return "Call";
}

function formatTransferReason(value: string | null | undefined) {
  if (!value) return "Transfer triggered";
  return value.replaceAll("_", " ").toLowerCase();
}

function formatAnsweredByLabel(value?: "HUMAN" | "AI" | "UNKNOWN") {
  if (value === "HUMAN") return "Human";
  if (value === "AI") return "AI";
  return "Unknown";
}

function extractCallerName(call: OrgCallRecord) {
  if (String(call.frontDesk?.callerName || "").trim()) return String(call.frontDesk?.callerName || "").trim();
  if (String(call.displayName || "").trim()) return String(call.displayName || "").trim();
  return call.fromNumber;
}

function prioritySurface(priority: FrontDeskPriority | undefined, selected: boolean) {
  if (selected && priority === "urgent") return "border-rose-300 ring-1 ring-rose-300/40 bg-rose-50/50";
  if (selected && priority === "high") return "border-amber-300 ring-1 ring-amber-300/40 bg-amber-50/50";
  if (selected) return "border-primary ring-1 ring-primary/20 shadow-[0_10px_24px_rgba(31,58,138,0.08)]";
  if (priority === "urgent") return "border-rose-200 hover:bg-rose-50/40 hover:shadow-[0_10px_22px_rgba(244,63,94,0.08)]";
  if (priority === "high") return "border-amber-200 hover:bg-amber-50/30 hover:shadow-[0_10px_22px_rgba(245,158,11,0.08)]";
  return "hover:-translate-y-px hover:bg-muted/20 hover:shadow-[0_10px_22px_rgba(15,23,42,0.06)]";
}

function formatPriorityLabel(priority: FrontDeskPriority | undefined) {
  return frontDeskPriorityMeta(priority).label;
}

function callQueueStateLabel(call: OrgCallRecord) {
  if (call.frontDesk?.followUpState === "needs_follow_up") return "Needs follow-up";
  if (call.frontDesk?.followUpState === "contacted") return "Contacted";
  if (call.frontDesk?.followUpState === "booked") return "Booked";
  if (call.frontDesk?.followUpState === "closed") return "Resolved";
  if (call.frontDesk?.followUpState === "spam") return "Spam";
  return outcomeLabel(call.outcome);
}

function callWorkTypeLabel(call: OrgCallRecord) {
  if (call.frontDesk?.recommendedAction === "Call back now") return "Callback";
  if (call.frontDesk?.recommendedAction === "Offer times") return "Scheduling";
  if (call.frontDesk?.followUpState === "booked") return "Booked work";
  if (call.frontDesk?.followUpState === "closed") return "Resolved";
  if (call.frontDesk?.followUpState === "spam") return "Spam";
  return "General review";
}

function callQuickActions(call: OrgCallRecord | null): Array<{ label: string; stage: PipelineStage; tone: "default" | "outline" }> {
  if (!call?.leadId) return [];
  if (call.frontDesk?.followUpState === "booked") {
    return [
      { label: "Mark booked", stage: "SCHEDULED", tone: "default" },
      { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
    ];
  }
  if (call.frontDesk?.recommendedAction === "Offer times" || call.frontDesk?.followUpState === "contacted") {
    return [
      { label: "Schedule appointment", stage: "NEEDS_SCHEDULING", tone: "default" },
      { label: "Mark booked", stage: "SCHEDULED", tone: "outline" }
    ];
  }
  return [
    { label: "Schedule appointment", stage: "NEEDS_SCHEDULING", tone: "default" },
    { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
  ];
}

function recoveryStatus(call: OrgCallRecord) {
  if (!call.recoverySmsSentAt) return null;
  if (String(call.recoverySmsResponse || "").trim()) {
    return {
      label: "Recovery reply received",
      detail: call.recoverySmsResponse || "Customer replied to the recovery text.",
      tone: "success" as const
    };
  }
  return {
    label: "Recovery text sent",
    detail: "No reply yet. Call back if the customer still needs help.",
    tone: "warning" as const
  };
}

function latestCallMovementLabel(call: OrgCallRecord) {
  if (String(call.recoverySmsResponse || "").trim()) return "Customer replied";
  if (call.recoverySmsSentAt) return "Office sent recovery text";
  if (call.frontDesk?.followUpState === "contacted") return "Office sent follow-up";
  return "No follow-up movement yet";
}

function callPrimaryActionLabel(call: OrgCallRecord) {
  if (String(call.recoverySmsResponse || "").trim() && call.recoverySmsThreadId) return "Review reply";
  return call.frontDesk?.recommendedAction || getNextAction(call);
}

function callStateFilterLabel(value: (typeof callStateFilters)[number]) {
  switch (value) {
    case "needs_follow_up":
      return "Needs follow-up";
    case "contacted":
      return "Contacted";
    case "booked":
      return "Booked";
    case "closed":
      return "Resolved";
    case "spam":
      return "Spam";
    default:
      return "All";
  }
}

function callOutcomeNote(call: OrgCallRecord | null) {
  if (!call) return null;
  if (call.frontDesk?.followUpState === "booked") {
    return "This call already led to booked work. Use the linked booking or inbox thread only if the office needs to confirm the schedule.";
  }
  if (call.frontDesk?.followUpState === "closed") {
    return "This call is already resolved. Review the transcript or linked records only if the office needs to revisit the outcome.";
  }
  return null;
}

function callOutcomeListNote(call: OrgCallRecord) {
  if (call.frontDesk?.followUpState === "booked") return "Booked work already confirmed.";
  if (call.frontDesk?.followUpState === "closed") return "Handled and resolved by the office.";
  if (call.recoverySmsResponse) return "Saved missed call with a live text reply.";
  return null;
}

function callOutcomeBadge(call: OrgCallRecord) {
  if (call.frontDesk?.followUpState === "booked") return frontDeskOutcomeBadgeMeta("booked");
  if (call.frontDesk?.followUpState === "closed") return frontDeskOutcomeBadgeMeta("resolved");
  if (call.recoverySmsResponse) return frontDeskOutcomeBadgeMeta("saved");
  return null;
}

export default function AppCallsPage() {
  const searchParams = useSearchParams();
  const deepLinkedCallId = searchParams.get("callId") || "";
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalVisible, setTotalVisible] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedCall, setSelectedCall] = useState<OrgCallRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"ALL" | OrgCallRecord["outcome"]>("ALL");
  const [stateFilter, setStateFilter] = useState<(typeof callStateFilters)[number]>("ALL");
  const [canEditPipeline, setCanEditPipeline] = useState(false);
  const [savingLeadStage, setSavingLeadStage] = useState<PipelineStage | null>(null);
  const detailsRef = useRef<HTMLElement | null>(null);
  const callItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const shouldScrollToDetailsRef = useRef(false);
  const shouldScrollToQueueItemRef = useRef(false);
  const selectedCallIdRef = useRef<string | null>(null);
  const queryRef = useRef(query);
  const outcomeFilterRef = useRef(outcomeFilter);
  const pageRef = useRef(page);

  const loadCalls = useCallback(async (next: { query: string; outcome: "ALL" | OrgCallRecord["outcome"]; page: number }) => {
    try {
      const queryText = next.query.trim();
      const data = await fetchOrgCalls({
        page: next.page,
        pageSize: 25,
        ...(next.outcome !== "ALL" ? { outcome: next.outcome } : {}),
        ...(deepLinkedCallId ? { callId: deepLinkedCallId } : {}),
        ...(queryText ? { query: queryText } : {})
      });
      setCalls(data.calls);
      setPage(data.page);
      setTotalVisible(data.totalVisible);
      setTotalPages(data.totalPages);
      setAssignedPhoneNumber(data.assignedPhoneNumber);
      setAssignedNumberProvider(data.assignedNumberProvider);
      setLastUpdated(new Date());
      if (deepLinkedCallId) {
        const directMatch = data.calls.find((item) => item.id === deepLinkedCallId) || null;
        if (directMatch) {
          shouldScrollToDetailsRef.current = true;
          shouldScrollToQueueItemRef.current = true;
          setSelectedCall(directMatch);
        }
      }
      if (selectedCallIdRef.current) {
        const fresh = data.calls.find((item) => item.id === selectedCallIdRef.current) || null;
        setSelectedCall(fresh);
      }
    } catch {
      if (!calls.length) {
        setCalls([]);
        setTotalVisible(0);
        setTotalPages(1);
        setAssignedPhoneNumber(null);
        setAssignedNumberProvider(null);
      }
    } finally {
      setLoading(false);
    }
  }, [calls.length, deepLinkedCallId]);

  const refreshAndRepopulate = useCallback(async () => {
    setRefreshing(true);
    try {
      await repopulateOrgCalls();
    } catch {
      // still refresh current data
    } finally {
      await loadCalls({ query, outcome: outcomeFilter, page });
      setRefreshing(false);
    }
  }, [loadCalls, outcomeFilter, page, query]);

  useEffect(() => {
    queryRef.current = query;
    outcomeFilterRef.current = outcomeFilter;
    pageRef.current = page;
  }, [query, outcomeFilter, page]);

  useEffect(() => {
    selectedCallIdRef.current = selectedCall?.id || null;
  }, [selectedCall]);

  useEffect(() => {
    void getMe()
      .then((me) => setCanEditPipeline(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role)))
      .catch(() => setCanEditPipeline(false));
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadCalls({ query: queryRef.current, outcome: outcomeFilterRef.current, page: pageRef.current });
    }, 12000);

    const refresh = () => void loadCalls({ query: queryRef.current, outcome: outcomeFilterRef.current, page: pageRef.current });
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadCalls]);

  useEffect(() => {
    void loadCalls({ query, outcome: outcomeFilter, page });
  }, [query, outcomeFilter, page, loadCalls]);

  useEffect(() => {
    if (!deepLinkedCallId) return;
    setQuery("");
    setOutcomeFilter("ALL");
    setStateFilter("ALL");
    setPage(1);
  }, [deepLinkedCallId]);

  useEffect(() => {
    if (!selectedCall || !detailsRef.current || !shouldScrollToDetailsRef.current) return;
    shouldScrollToDetailsRef.current = false;
    detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedCall]);

  const visibleCalls = useMemo(
    () =>
      [...calls]
        .filter((call) => {
          if (stateFilter === "ALL") return true;
          return (call.frontDesk?.followUpState || "closed") === stateFilter;
        })
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [calls, stateFilter]
  );

  const callsByDay = useMemo(() => {
    const groups: Array<{ day: string; label: string; calls: OrgCallRecord[] }> = [];
    for (const call of visibleCalls) {
      const day = callDayKey(call.startedAt);
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.day !== day) {
        groups.push({ day, label: formatQueueDayHeading(day), calls: [call] });
      } else {
        lastGroup.calls.push(call);
      }
    }
    return groups;
  }, [visibleCalls]);

  useEffect(() => {
    if (!deepLinkedCallId || !shouldScrollToQueueItemRef.current) return;
    const target = callItemRefs.current[deepLinkedCallId];
    if (!target) return;
    shouldScrollToQueueItemRef.current = false;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [callsByDay, deepLinkedCallId]);

  const metrics = useMemo(() => {
    const totalVisible = visibleCalls.length;
    if (!totalVisible) {
      return { totalVisible, needsReview: 0, requestCount: 0, urgentCount: 0 };
    }
    return {
      totalVisible,
      needsReview: visibleCalls.filter((call) => call.frontDesk?.needsFollowUp || call.outcome === "MISSED" || call.outcome === "ABANDONED" || Boolean(call.unansweredTransfer)).length,
      requestCount: visibleCalls.filter((call) => call.outcome === "APPOINTMENT_REQUEST").length,
      urgentCount: visibleCalls.filter((call) => call.frontDesk?.frontDeskPriority === "urgent").length
    };
  }, [visibleCalls]);

  const filteredLabel = outcomeFilter === "ALL" ? "All calls" : outcomeFilter.replaceAll("_", " ").toLowerCase();

  async function onQuickAction(stage: PipelineStage) {
    if (!selectedCall?.leadId || !canEditPipeline) return;
    setSavingLeadStage(stage);
    try {
      await updateLeadPipelineStage(selectedCall.leadId, stage);
      await loadCalls({ query: queryRef.current, outcome: outcomeFilterRef.current, page: pageRef.current });
    } finally {
      setSavingLeadStage(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Reviewed Calls</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Call Queue</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input readOnly value="" placeholder="Search calls..." className="h-10 w-64 rounded-2xl border-slate-200 bg-slate-50 pl-10" />
            </label>
            <Button onClick={() => void refreshAndRepopulate()} disabled={refreshing} className="rounded-2xl">
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-4">
          <div className={frontDeskContextPanelClass()}>
            <p className="page-eyebrow">Visible calls</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{metrics.totalVisible}</p>
            <p className="mt-1 text-xs text-muted-foreground">Calls in the current filtered queue.</p>
          </div>
          <div className={frontDeskContextPanelClass()}>
            <p className="page-eyebrow">Needs attention</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{metrics.needsReview} call{metrics.needsReview === 1 ? "" : "s"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Still needs callback, review, or handoff verification.</p>
          </div>
          <div className={frontDeskContextPanelClass()}>
            <p className="page-eyebrow">Booking requests</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{metrics.requestCount} request{metrics.requestCount === 1 ? "" : "s"}</p>
            <p className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <PhoneCall className="h-3.5 w-3.5" />
              Requests that can move directly into scheduling.
            </p>
          </div>
          <div className={frontDeskContextPanelClass()}>
            <p className="page-eyebrow">Urgent</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{metrics.urgentCount} high-priority item{metrics.urgentCount === 1 ? "" : "s"}</p>
            <p className="mt-1 text-xs text-muted-foreground">The office should work these first.</p>
          </div>
        </div>
      </section>

      <PageHelpFab
        items={[
          { label: "Use this page", text: "Work calls that still need callback, review, or escalation from the original phone conversation." },
          { label: "Start here", text: "Open the newest call first, confirm what the customer needed, then follow the next action before reading the transcript." },
          { label: "Go next", text: "Move to Inbox when the customer already replied by text, or Booking Queue when the request is ready for scheduling." }
        ]}
      />

      <ClientStatusGrid
        items={[
          {
            label: connectedNumberProviderLabel(assignedNumberProvider),
            value: assignedPhoneNumber || "Not assigned",
            detail: connectedNumberProviderDetail(assignedNumberProvider),
            tone: assignedPhoneNumber ? "success" : "warning"
          },
          {
            label: "Visible calls",
            value: metrics.totalVisible,
            detail: `Page ${page} of ${totalPages}`
          },
          {
            label: "Needs attention",
            value: metrics.needsReview,
            detail: "Calls on this page that still need callback, review, or office action."
          },
          {
            label: "Urgent",
            value: metrics.urgentCount,
            detail: "Highest-priority call items in the current queue."
          }
        ]}
      />

      <Card className={frontDeskWorkspaceCardClass("hero")}>
        <CardContent className="grid gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="page-eyebrow">Connected line</p>
              <p className="text-lg font-semibold text-foreground">
                {assignedPhoneNumber || "Not assigned"}
              </p>
              <p className="text-sm text-muted-foreground">{assignedNumberProvider ? "Live calls are flowing through the connected business number." : "Complete number setup before relying on this queue for live operations."}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Showing {filteredLabel}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{callsByDay[0]?.label || "Recent queue"}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Updated {formatRelativeUpdate(lastUpdated)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{totalVisible} matching calls</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["ALL", "MISSED", "ABANDONED", "TRANSFERRED", "APPOINTMENT_REQUEST", "MESSAGE_TAKEN"].map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                  outcomeFilter === value
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(31,58,138,0.16)]"
                    : "bg-white text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => {
                  setOutcomeFilter(value as "ALL" | OrgCallRecord["outcome"]);
                  setPage(1);
                }}
              >
                {value === "ALL" ? "All" : value.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {[
          { label: "Visible calls", value: metrics.totalVisible, meta: `Page ${page} of ${totalPages}` },
          { label: "Needs attention", value: metrics.needsReview, meta: "Calls that still need office action" },
          { label: "Requests captured", value: metrics.requestCount, meta: "Appointment requests on this page" },
          { label: "Urgent", value: metrics.urgentCount, meta: "Urgent front-desk items on this page" }
        ].map((item) => (
          <Card key={item.label} className={frontDeskMetricCardClass()}>
            <CardContent className="p-5">
              <p className="page-eyebrow">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.meta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4 min-w-0">
          <Card className={frontDeskWorkspaceCardClass("subtle")}>
            <CardContent className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="page-eyebrow">Review queue</p>
                  <p className="text-sm text-muted-foreground">
                    Search the queue, open a call, then review the structured summary and recommended next step.
                  </p>
                </div>
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by caller name, phone number, summary, or call ID"
                />
                <div className="flex flex-wrap gap-2">
                  {callStateFilters.map((filter) => {
                    const count =
                      filter === "ALL"
                        ? calls.length
                        : calls.filter((call) => (call.frontDesk?.followUpState || "closed") === filter).length;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setStateFilter(filter)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          stateFilter === filter
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {callStateFilterLabel(filter)} <span className="text-xs text-muted-foreground">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className={`${frontDeskContextPanelClass()} text-sm`}>
                <p className="font-medium text-foreground">Queue summary</p>
                <div className="mt-3 space-y-2 text-muted-foreground">
                  <p>{metrics.totalVisible} visible calls across the current queue.</p>
                  <p>{calls.length} calls currently loaded on page {page} before queue-state filtering.</p>
                  <p>Calls are grouped by day with the newest activity first so the latest work stays on top.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="page-eyebrow">Call list</p>
                <p className="text-sm text-muted-foreground">Open a call to inspect the structured intake result, follow-up state, and next step.</p>
              </div>
              <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-medium text-muted-foreground">
                {visibleCalls.length} visible on this page
              </span>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className={frontDeskLoadingCardClass()}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className={frontDeskSkeletonLineClass("md")} />
                          <div className={frontDeskSkeletonLineClass("sm")} />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200/90" />
                          <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200/90" />
                        </div>
                      </div>
                      <div className="h-6 w-32 animate-pulse rounded-full bg-slate-200/90" />
                      <div className={frontDeskSkeletonLineClass()} />
                      <div className={frontDeskSkeletonLineClass("lg")} />
                    </div>
                  </div>
                ))}
              </div>
            ) : callsByDay.length ? (
              callsByDay.map((group) => (
                <div key={group.day} className="space-y-3">
                  <div className="sticky top-[5.25rem] z-10 -mx-1 rounded-full bg-background/85 px-1 py-1 backdrop-blur">
                    <div className="flex items-center gap-3 px-2">
                      <p className="page-eyebrow">{group.label}</p>
                      <div className="h-px flex-1 bg-border/70" />
                      <span className="text-xs text-muted-foreground">{group.calls.length} call{group.calls.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  {group.calls.map((call) => {
                    const selected = selectedCall?.id === call.id;
                    const linked = call.id === deepLinkedCallId;
                    return (
                      <button
                        key={call.id}
                        ref={(node) => {
                          callItemRefs.current[call.id] = node;
                        }}
                        type="button"
                        onClick={() => {
                          shouldScrollToDetailsRef.current = selectedCall?.id !== call.id;
                          setSelectedCall(call);
                        }}
                        className={`w-full p-5 text-left transition-all ${frontDeskCardClass("default")} ${
                          call.frontDesk?.followUpState === "closed"
                            ? frontDeskOutcomeSurfaceClass("resolved")
                            : call.frontDesk?.followUpState === "booked"
                              ? frontDeskOutcomeSurfaceClass("booked")
                              : call.recoverySmsResponse
                                ? frontDeskOutcomeSurfaceClass("saved")
                                : frontDeskOutcomeSurfaceClass("active")
                        } ${prioritySurface(call.frontDesk?.frontDeskPriority, selected || linked)} ${linked ? "ring-2 ring-primary/30 shadow-[0_18px_36px_rgba(31,58,138,0.12)]" : ""}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-base font-semibold text-foreground">{extractCallerName(call)}</p>
                            <p className="text-sm text-muted-foreground">{call.fromNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(call.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            {linked ? <Badge className={clientBadgeClass("pending")}>Opened from another workspace</Badge> : null}
                            <Badge className={frontDeskPriorityBadgeClass(call.frontDesk?.frontDeskPriority)}>{frontDeskPriorityMeta(call.frontDesk?.frontDeskPriority).label}</Badge>
                            <Badge className={clientBadgeClass(getDispositionTone(call))}>{callWorkTypeLabel(call)}</Badge>
                            <Badge className={clientBadgeClass(getDispositionTone(call))}>{getDispositionLabel(call)}</Badge>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(callPrimaryActionLabel(call))}`}>
                            {callPrimaryActionLabel(call)}
                          </span>
                          <span className="rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            {callQueueStateLabel(call)}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {call.frontDesk?.summary || call.aiSummary || call.summary || "No summary available yet."}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{call.frontDesk?.serviceRequested || outcomeLabel(call.outcome)}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>{call.frontDesk?.urgency || "Standard priority"}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{call.frontDesk?.appointmentRequested ? "Appointment requested" : "No appointment requested"}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>{formatDuration(call.durationSec || 0)}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>{latestCallMovementLabel(call)}</span>
                          {recoveryStatus(call) ? (
                            <>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span>{recoveryStatus(call)?.label}</span>
                            </>
                          ) : null}
                        </div>
                        {callOutcomeBadge(call) ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className={clientBadgeClass(callOutcomeBadge(call)!.tone)}>{callOutcomeBadge(call)!.label}</Badge>
                          </div>
                        ) : null}
                        {callOutcomeListNote(call) ? (
                          <p className="mt-3 rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{callOutcomeListNote(call)}</p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className={frontDeskEmptyStateClass()}>
                No calls match this queue yet. When customers call or miss the business line, their request will appear here with a summary and the next office action.
              </div>
            )}
          </div>
          {totalPages > 1 ? (
            <Card className={frontDeskWorkspaceCardClass("subtle")}>
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="page-eyebrow">Queue pages</p>
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages} across the newest matching calls.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                    Previous page
                  </Button>
                  <Button variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                    Next page
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <section ref={detailsRef} className="2xl:sticky 2xl:top-24 2xl:self-start">
          <Card className={frontDeskWorkspaceCardClass("default")}>
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className={frontDeskSkeletonLineClass("sm")} />
                    <div className={frontDeskSkeletonLineClass("md")} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={item} className={frontDeskLoadingCardClass()}>
                        <div className="space-y-3">
                          <div className={frontDeskSkeletonLineClass("sm")} />
                          <div className={frontDeskSkeletonLineClass("md")} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedCall ? (
                <div className="space-y-6">
                  {deepLinkedCallId && selectedCall.id === deepLinkedCallId ? (
                    <div className={`${frontDeskContextPanelClass()} border-primary/20 text-sm`}>
                      <p className="page-eyebrow">Linked call</p>
                      <p className="mt-2 font-medium text-slate-950">
                        You were sent here for {extractCallerName(selectedCall)} at{" "}
                        {new Date(selectedCall.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
                      </p>
                      <p className="mt-1 text-slate-700">
                        This is the call another workspace linked you to. Review it first, then move into Inbox, Booking Queue, or Lead Queue if the next step lives there.
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <p className="page-eyebrow">Selected call</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl">{extractCallerName(selectedCall)}</h2>
                          <Badge className={clientBadgeClass(getDispositionTone(selectedCall))}>{getDispositionLabel(selectedCall)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{selectedCall.fromNumber}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          shouldScrollToDetailsRef.current = false;
                          setSelectedCall(null);
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["Started", new Date(selectedCall.startedAt).toLocaleString()],
                        ["Duration", formatDuration(selectedCall.durationSec || 0)],
                        ["Answered by", formatAnsweredByLabel(selectedCall.answeredByLabel)],
                        ["Priority", formatPriorityLabel(selectedCall.frontDesk?.frontDeskPriority)],
                        ["Next step", getNextAction(selectedCall)]
                      ].map(([label, value]) => (
                      <div key={label} className={frontDeskContextPanelClass()}>
                        <p className="page-eyebrow">{label}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  {selectedCall.outcome === "TRANSFERRED" || selectedCall.recoverySmsSentAt ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedCall.outcome === "TRANSFERRED" ? (
                        <>
                          <div className={frontDeskContextPanelClass()}>
                            <p className="page-eyebrow">Transfer reason</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{formatTransferReason(selectedCall.transferReason)}</p>
                          </div>
                          <div className={frontDeskContextPanelClass()}>
                            <p className="page-eyebrow">Transfer target</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {selectedCall.transferTarget || "Office routing"}
                              {selectedCall.unansweredTransfer ? " (not answered)" : ""}
                            </p>
                          </div>
                        </>
                      ) : null}
                      {selectedCall.recoverySmsSentAt ? (
                        <>
                          <div className={frontDeskContextPanelClass()}>
                            <p className="page-eyebrow">Recovery SMS</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              Sent {new Date(selectedCall.recoverySmsSentAt).toLocaleString()}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">{recoveryStatus(selectedCall)?.label}</p>
                          </div>
                          <div className={frontDeskContextPanelClass()}>
                            <p className="page-eyebrow">Recovery response</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {selectedCall.recoverySmsResponse || "No reply yet"}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {recoveryStatus(selectedCall)?.detail || "Review the missed-call recovery path."}
                            </p>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <p className="page-eyebrow">Front-desk summary</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(callPrimaryActionLabel(selectedCall))}`}>
                        {callPrimaryActionLabel(selectedCall)}
                      </span>
                      <Badge className={frontDeskPriorityBadgeClass(selectedCall.frontDesk?.frontDeskPriority)}>
                        {frontDeskPriorityMeta(selectedCall.frontDesk?.frontDeskPriority).label}
                      </Badge>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {selectedCall.frontDesk?.summary || selectedCall.aiSummary || selectedCall.summary || "No summary available yet."}
                    </p>
                    <p className={`${frontDeskContextPanelClass()} text-sm text-muted-foreground`}>
                      Why this matters now: {callPrimaryActionLabel(selectedCall)}. Work this call here if the office still needs to callback or review it; otherwise jump straight into Inbox or Booking Queue when the follow-up already moved there.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["Caller", extractCallerName(selectedCall)],
                        ["Phone number", selectedCall.fromNumber],
                        ["Service requested", selectedCall.frontDesk?.serviceRequested || "Not captured"],
                        ["Urgency", selectedCall.frontDesk?.urgency || "Standard priority"],
                        ["Service location", selectedCall.frontDesk?.serviceLocation || "Not captured"],
                        ["Appointment requested", selectedCall.frontDesk?.appointmentRequested ? "Yes" : "No"],
                        ["Recommended action", callPrimaryActionLabel(selectedCall)],
                        ["Follow-up state", getDispositionLabel(selectedCall)],
                        ["Latest movement", latestCallMovementLabel(selectedCall)]
                      ].map(([label, value]) => (
                        <div key={label} className={frontDeskContextPanelClass()}>
                          <p className="page-eyebrow">{label}</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                    {(selectedCall.recoverySmsThreadId || selectedCall.leadId || selectedCall.appointmentRequestId || selectedCall.recordingUrl) ? (
                      <div className={`${frontDeskContextPanelClass()} space-y-3`}>
                        <div className="space-y-1">
                          <p className="page-eyebrow">Related workspaces</p>
                          <p className="text-sm text-muted-foreground">
                            Open the next workspace where the office should continue this request, then use the remaining links only if you need more context.
                          </p>
                        </div>
                        <div className="grid gap-2 sm:flex sm:flex-wrap">
                          {selectedCall.recoverySmsThreadId ? (
                            <Button asChild size="sm" className="w-full sm:w-auto">
                              <Link href={`/app/messages?threadId=${encodeURIComponent(selectedCall.recoverySmsThreadId)}`}>Open inbox</Link>
                            </Button>
                          ) : null}
                          {selectedCall.appointmentRequestId ? (
                            <Button asChild size="sm" variant={selectedCall.recoverySmsThreadId ? "outline" : "default"} className="w-full sm:w-auto">
                              <Link href={`/app/appointments?requestId=${encodeURIComponent(selectedCall.appointmentRequestId)}`}>Open booking</Link>
                            </Button>
                          ) : null}
                          {selectedCall.leadId ? (
                            <Button asChild size="sm" variant={selectedCall.recoverySmsThreadId || selectedCall.appointmentRequestId ? "outline" : "default"} className="w-full sm:w-auto">
                              <Link href={`/app/leads?leadId=${encodeURIComponent(selectedCall.leadId)}`}>Open lead</Link>
                            </Button>
                          ) : null}
                          {selectedCall.recordingUrl ? (
                            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                              <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer">
                                Open recording
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {selectedCall.leadId && canEditPipeline ? (
                      <div className="grid gap-2 sm:flex sm:flex-wrap">
                        {callQuickActions(selectedCall).map((action) => (
                          <Button
                            key={`${selectedCall.id}-${action.stage}`}
                            size="sm"
                            variant={action.tone}
                            className="w-full sm:w-auto"
                            disabled={savingLeadStage === action.stage}
                            onClick={() => void onQuickAction(action.stage)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                    {callOutcomeNote(selectedCall) ? (
                      <p className="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{callOutcomeNote(selectedCall)}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="page-eyebrow">Transcript</p>
                    <div className="max-h-72 overflow-auto rounded-xl border bg-muted/10 p-4 text-sm leading-6 text-muted-foreground">
                      {selectedCall.transcript || "No transcript available."}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="page-eyebrow">Call details</p>
                    <h2 className="text-2xl">Select a call</h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Open any call from the queue to review who called, what they need, and the next office action before you read the transcript or recording.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Review outcome", "Check whether the call became a request, transfer, message, or review item."],
                      ["Inspect summary", "Read the short summary first before digging into the transcript."],
                      ["Confirm next action", "See whether the office should call back, schedule, or just document the result."],
                      ["Open recording", "Jump to the recording only when quality or handoff review is needed."]
                    ].map(([label, value]) => (
                      <div key={label} className={frontDeskContextPanelClass()}>
                        <p className="page-eyebrow">{label}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
