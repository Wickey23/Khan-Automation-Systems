"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchOrgLeads, getMe, updateLeadPipelineStage } from "@/lib/api";
import type { FrontDeskPriority, Lead } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clientBadgeClass } from "@/lib/client-badges";

type PipelineStage = "NEW_LEAD" | "QUOTED" | "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED";
const queueTabs = [
  { label: "All Active", value: "ALL" },
  { label: "Priority: Urgent", value: "urgent" },
  { label: "Pending Actions", value: "needs_follow_up" },
  { label: "Scheduled Follow-ups", value: "booked" }
] as const;

function priorityWeight(priority: FrontDeskPriority | undefined) {
  if (priority === "urgent") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

function leadSummary(lead: Lead) {
  return lead.frontDesk?.summary || lead.serviceRequested || lead.message || "No request summary available.";
}

function recommendedAction(lead: Lead) {
  return lead.frontDesk?.recommendedAction || (lead.pipelineStage === "NEEDS_SCHEDULING" ? "Book Technician Appointment" : "Review lead");
}

function urgencyTone(lead: Lead) {
  if (lead.frontDesk?.frontDeskPriority === "urgent") return "critical" as const;
  if (lead.frontDesk?.frontDeskPriority === "high") return "warning" as const;
  return "neutral" as const;
}

function urgencyLabel(lead: Lead) {
  if (lead.frontDesk?.frontDeskPriority === "urgent") return "RED";
  if (lead.frontDesk?.frontDeskPriority === "high") return "AMBER";
  return "GREY";
}

function statusTone(lead: Lead) {
  if (lead.frontDesk?.state === "booked") return "booking" as const;
  if (lead.frontDesk?.state === "closed") return "success" as const;
  if (lead.frontDesk?.state === "contacted") return "pending" as const;
  return "warning" as const;
}

function statusLabel(lead: Lead) {
  if (lead.frontDesk?.state === "needs_follow_up") return "Awaiting Operator";
  if (lead.frontDesk?.state === "contacted") return "In Progress";
  if (lead.frontDesk?.state === "booked") return "Booked";
  if (lead.frontDesk?.state === "closed") return "Handled";
  return "New";
}

function sourceLabel(lead: Lead) {
  if (lead.latestCallId) return `From Call #${lead.latestCallId.slice(0, 4)}`;
  if (lead.source === "WEB_FORM") return "Web Inquiry";
  if (lead.source === "SMS") return "SMS Lead";
  return lead.source || "Lead";
}

function sourceSubLabel(lead: Lead) {
  const name = lead.name || "Unknown customer";
  const time = new Date(lead.frontDesk?.lastActivityAt || lead.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${name} | ${time}`;
}

function actionOptions(lead: Lead): Array<{ label: string; href?: string }> {
  return [
    { label: "Call Back Now", href: lead.latestCallId ? `/app/calls?callId=${encodeURIComponent(lead.latestCallId)}` : undefined },
    { label: "Send SMS Confirmation", href: lead.latestMessageThreadId ? `/app/messages?threadId=${encodeURIComponent(lead.latestMessageThreadId)}` : undefined },
    { label: "Book Technician Appointment", href: lead.latestAppointmentRequestId ? `/app/appointments?requestId=${encodeURIComponent(lead.latestAppointmentRequestId)}` : "/app/appointments" }
  ];
}

export default function AppLeadsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const highlightedLeadId = searchParams.get("leadId") || "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof queueTabs)[number]["value"]>("ALL");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(highlightedLeadId || null);
  const [savingStage, setSavingStage] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void Promise.all([fetchOrgLeads(), getMe()])
      .then(([leadData, me]) => {
        const rows = leadData.leads || [];
        setLeads(rows);
        setCanEdit(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role));
        setSelectedLeadId((current) => current || rows[0]?.id || null);
      })
      .catch(() => {
        setLeads([]);
        setCanEdit(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...leads]
      .filter((lead) => {
        if (tab === "urgent" && lead.frontDesk?.frontDeskPriority !== "urgent") return false;
        if (tab === "needs_follow_up" && lead.frontDesk?.state !== "needs_follow_up") return false;
        if (tab === "booked" && lead.frontDesk?.state !== "booked") return false;
        if (!q) return true;
        return [
          lead.name,
          lead.business,
          lead.phone,
          lead.email,
          leadSummary(lead),
          recommendedAction(lead),
          lead.latestCallId || "",
          lead.latestMessageThreadId || ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const priority = priorityWeight(a.frontDesk?.frontDeskPriority) - priorityWeight(b.frontDesk?.frontDeskPriority);
        if (priority !== 0) return priority;
        return new Date(b.frontDesk?.lastActivityAt || b.updatedAt).getTime() - new Date(a.frontDesk?.lastActivityAt || a.updatedAt).getTime();
      });
  }, [leads, query, tab]);

  const selectedLead = useMemo(
    () => filtered.find((lead) => lead.id === selectedLeadId) || filtered[0] || null,
    [filtered, selectedLeadId]
  );

  async function onChangeStage(leadId: string, stage: PipelineStage) {
    if (!canEdit) return;
    setSavingStage(`${leadId}:${stage}`);
    try {
      await updateLeadPipelineStage(leadId, stage);
      setLeads((current) => current.map((lead) => (lead.id === leadId ? { ...lead, pipelineStage: stage } : lead)));
      showToast({ title: "Lead updated" });
    } catch (error) {
      showToast({ title: "Could not update lead", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSavingStage(null);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] overflow-hidden rounded-[20px] border border-slate-200 bg-background-light shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
      <aside className="fixed hidden h-full w-64 flex-col border-r border-slate-200 bg-white xl:flex">
        <div className="flex items-center gap-3 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined">desk</span>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-950">Front Desk OS</h1>
            <p className="text-xs text-slate-500">Receptionist View</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-4">
          <Link href="/app" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-slate-50">
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 rounded-lg border-l-4 border-primary bg-primary/10 px-3 py-2 text-primary">
            <span className="material-symbols-outlined text-xl">view_list</span>
            <span className="text-sm font-semibold">Lead Queue</span>
          </div>
          <Link href="/app/calls" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-slate-50">
            <span className="material-symbols-outlined text-xl">call</span>
            <span className="text-sm font-medium">Calls</span>
          </Link>
          <Link href="/app/messages" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-slate-50">
            <span className="material-symbols-outlined text-xl">chat</span>
            <span className="text-sm font-medium">Messages</span>
          </Link>
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col xl:ml-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-bold text-slate-950">Lead Queue</h2>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-80 rounded-lg border-0 bg-slate-100 pl-10 focus-visible:ring-2 focus-visible:ring-primary/20"
                placeholder="Search leads, calls, or customers..."
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              <span className="material-symbols-outlined text-xl">notifications</span>
            </button>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              <span className="material-symbols-outlined text-xl">help</span>
            </button>
          </div>
        </header>

        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-8">
          <div className="flex gap-8">
            {queueTabs.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={`py-4 text-sm font-bold ${tab === item.value ? "border-b-2 border-primary text-primary" : "border-b-2 border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                {item.label}
                {item.value === "ALL" ? ` (${filtered.length})` : ""}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Sort by:</span>
            <select className="cursor-pointer border-none bg-transparent text-xs font-bold focus:ring-0">
              <option>Newest First</option>
              <option>Urgency</option>
            </select>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-2 grid grid-cols-12 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
              <div className="col-span-3">Lead Source</div>
              <div className="col-span-2 text-center">Urgency</div>
              <div className="col-span-3">Recommended Action</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-2 text-right">Links</div>
            </div>

            <div className="grid gap-4">
              {loading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading lead queue...</div>
              ) : filtered.length ? (
                filtered.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`grid grid-cols-12 items-center rounded-xl border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md ${
                      selectedLead?.id === lead.id ? "ring-2 ring-primary/40 ring-offset-2" : ""
                    } ${
                      lead.frontDesk?.frontDeskPriority === "urgent"
                        ? "border-l-4 border-l-red-500"
                        : lead.frontDesk?.frontDeskPriority === "high"
                          ? "border-l-4 border-l-amber-500"
                          : "border-l-4 border-l-slate-300"
                    }`}
                  >
                    <div className="col-span-3">
                      <p className="text-sm font-bold text-slate-950">{sourceLabel(lead)}</p>
                      <p className="text-xs text-slate-500">{sourceSubLabel(lead)}</p>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Badge className={clientBadgeClass(urgencyTone(lead))}>{urgencyLabel(lead)}</Badge>
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-primary">
                        <span className="material-symbols-outlined text-lg">
                          {recommendedAction(lead).toLowerCase().includes("call")
                            ? "bolt"
                            : recommendedAction(lead).toLowerCase().includes("book")
                              ? "calendar_today"
                              : "description"}
                        </span>
                        {recommendedAction(lead)}
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Badge className={clientBadgeClass(statusTone(lead))}>{statusLabel(lead)}</Badge>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2">
                      {lead.latestCallId ? (
                        <Link href={`/app/calls?callId=${encodeURIComponent(lead.latestCallId)}`} className="rounded-lg p-2 text-slate-400 hover:bg-primary/10 hover:text-primary">
                          <span className="material-symbols-outlined">play_circle</span>
                        </Link>
                      ) : null}
                      {lead.latestMessageThreadId ? (
                        <Link href={`/app/messages?threadId=${encodeURIComponent(lead.latestMessageThreadId)}`} className="rounded-lg p-2 text-slate-400 hover:bg-primary/10 hover:text-primary">
                          <span className="material-symbols-outlined">forum</span>
                        </Link>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No leads match this queue.</div>
              )}
            </div>
          </div>

          <aside className="w-[450px] overflow-y-auto border-l border-slate-200 bg-white p-8">
            {selectedLead ? (
              <>
                <div className="mb-8 flex items-start justify-between">
                  <div>
                    <h3 className="mb-1 text-xl font-bold leading-tight text-slate-950">Lead Context</h3>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Case #{selectedLead.id.slice(0, 8)}</p>
                  </div>
                  <Button
                    disabled={!canEdit || savingStage === `${selectedLead.id}:COMPLETED`}
                    onClick={() => void onChangeStage(selectedLead.id, "COMPLETED")}
                    className="gap-2 shadow-lg shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-base">task_alt</span>
                    Mark Handled
                  </Button>
                </div>

                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-4 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary">
                      {(selectedLead.name || "U").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-950">{selectedLead.name || "Unknown customer"}</p>
                      <p className="text-sm text-slate-500">{selectedLead.phone || selectedLead.email || "No contact info"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Booking State</p>
                      <p className="mt-1 text-sm font-bold text-blue-500">
                        {selectedLead.pipelineStage?.replaceAll("_", " ") || "Pending Request"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Lifetime Value</p>
                      <p className="mt-1 text-sm font-bold text-slate-950">{selectedLead.business || "Not Captured"}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Call Transcript Summary</h4>
                  <div className="space-y-4">
                    <div className="relative border-l-2 border-slate-200 pl-6">
                      <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-primary ring-4 ring-white" />
                      <p className="mb-1 text-xs font-bold text-slate-400">
                        {selectedLead.latestCallId ? `Call ${selectedLead.latestCallId.slice(0, 4)}` : "Lead Summary"} | {new Date(selectedLead.frontDesk?.lastActivityAt || selectedLead.updatedAt).toLocaleString()}
                      </p>
                      <p className="text-sm font-medium italic text-slate-600">&ldquo;{leadSummary(selectedLead)}&rdquo;</p>
                    </div>
                    <div className="relative border-l-2 border-slate-200 pl-6">
                      <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white" />
                      <p className="text-sm text-slate-600">{selectedLead.frontDesk?.recommendedAction || "Awaiting next office action."}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="mb-2 text-xs font-bold uppercase text-slate-400">Primary Actions</p>
                  {actionOptions(selectedLead).map((action) =>
                    action.href ? (
                      <Button key={action.label} asChild variant={action.label === "Call Back Now" ? "default" : "outline"} className="w-full justify-between rounded-xl p-4">
                        <Link href={action.href}>
                          <span className="flex items-center gap-3">
                            <span className="material-symbols-outlined">
                              {action.label.includes("Call") ? "call" : action.label.includes("SMS") ? "send_to_mobile" : "calendar_today"}
                            </span>
                            <span className="font-bold">{action.label}</span>
                          </span>
                          <span className="material-symbols-outlined">chevron_right</span>
                        </Link>
                      </Button>
                    ) : null
                  )}
                </div>

                <div className="mt-8">
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Operator Notes</label>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="h-24 rounded-xl border-slate-200 bg-slate-50 p-3 text-sm"
                    placeholder="Type internal notes here..."
                  />
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Select a lead to review its context and next actions.</div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
