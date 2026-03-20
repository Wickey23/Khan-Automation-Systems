"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Sparkles,
  Tag,
  User
} from "lucide-react";
import { fetchOrgLeads, getMe, updateLeadPipelineStage } from "@/lib/api";
import type { FrontDeskPriority, Lead } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PipelineStage = "NEW_LEAD" | "QUOTED" | "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED";

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "FD";
}

function leadName(lead: Lead) {
  return String(lead.name || lead.phone || lead.email || "Unknown lead").trim();
}

function leadStatus(lead: Lead) {
  if (lead.frontDesk?.state === "needs_follow_up") return "New Inquiry";
  if (lead.frontDesk?.state === "contacted") return "Awaiting Reply";
  if (lead.frontDesk?.state === "booked") return "Qualified";
  if (lead.frontDesk?.state === "closed") return "Resolved";
  if (lead.frontDesk?.state === "spam") return "Spam";
  return lead.status.replaceAll("_", " ");
}

function leadUrgency(priority?: FrontDeskPriority) {
  if (priority === "urgent") return { label: "High", color: "text-red-600", bg: "bg-red-50" };
  if (priority === "high") return { label: "Medium", color: "text-amber-600", bg: "bg-amber-50" };
  if (priority === "normal") return { label: "Medium", color: "text-amber-600", bg: "bg-amber-50" };
  return { label: "Low", color: "text-slate-600", bg: "bg-slate-50" };
}

function leadSummary(lead: Lead) {
  return lead.frontDesk?.summary || lead.serviceRequested || lead.message || "No lead summary available yet.";
}

function leadSource(lead: Lead) {
  if (lead.source === "PHONE_CALL") return "Direct Dial";
  if (lead.source === "SMS") return "SMS";
  if (lead.source === "WEB_FORM") return "Web Form";
  return lead.source || lead.sourcePage || "Lead Queue";
}

function leadRecommendedAction(lead: Lead) {
  return lead.frontDesk?.recommendedAction || (lead.pipelineStage === "NEEDS_SCHEDULING" ? "Book Appointment" : "Review Lead");
}

function activityLabel(lead: Lead) {
  const value = lead.frontDesk?.lastActivityAt || lead.updatedAt || lead.createdAt;
  const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 60) return `${mins || 1} mins ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hrs ago`;
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function AppLeadsPage() {
  const searchParams = useSearchParams();
  const highlightedLeadId = searchParams.get("leadId") || "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [canEdit, setCanEdit] = useState(false);
  const [savingStage, setSavingStage] = useState<PipelineStage | null>(null);

  useEffect(() => {
    void getMe()
      .then((me) => setCanEdit(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role)))
      .catch(() => setCanEdit(false));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchOrgLeads()
      .then((data) => {
        if (!active) return;
        setLeads(data.leads || []);
        setSelectedLeadId((current) => highlightedLeadId || current || data.leads?.[0]?.id || "");
      })
      .catch(() => {
        if (!active) return;
        setLeads([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [highlightedLeadId]);

  const filteredLeads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (!term) return true;
      return [
        lead.id,
        leadName(lead),
        lead.phone,
        lead.email,
        lead.business,
        leadSource(lead),
        leadSummary(lead),
        leadRecommendedAction(lead)
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [leads, query]);

  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) ||
    leads.find((lead) => lead.id === selectedLeadId) ||
    filteredLeads[0] ||
    leads[0] ||
    null;

  async function setStage(stage: PipelineStage) {
    if (!selectedLead || !canEdit) return;
    setSavingStage(stage);
    try {
      await updateLeadPipelineStage(selectedLead.id, stage);
      setLeads((current) => current.map((lead) => (lead.id === selectedLead.id ? { ...lead, pipelineStage: stage } : lead)));
    } finally {
      setSavingStage(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-[calc(100vh-15rem)] overflow-hidden bg-white">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-slate-900">Lead Queue</h1>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button className="rounded-md bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">Active Leads ({filteredLeads.length})</button>
                <button className="px-3 py-1 text-xs font-medium text-slate-500">Archived</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search leads..."
                  className="h-8 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>
              <button className="flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white shadow-sm hover:bg-primary/90">
                <Plus className="h-3.5 w-3.5" />
                Add Lead
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-6 py-3">Lead Info</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Urgency</th>
                  <th className="px-6 py-3">Last Activity</th>
                  <th className="px-6 py-3 text-right">Recommended Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td className="px-6 py-10 text-sm text-slate-500" colSpan={5}>Loading leads...</td></tr>
                ) : filteredLeads.length ? (
                  filteredLeads.map((lead) => {
                    const urgency = leadUrgency(lead.frontDesk?.frontDeskPriority);
                    const selected = selectedLead?.id === lead.id;
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={cn("group cursor-pointer transition-colors hover:bg-slate-50", selected && "bg-primary/5")}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold shadow-sm",
                              selected ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                            )}>
                              {initials(leadName(lead))}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900">{leadName(lead)}</div>
                              <div className="text-[11px] font-medium text-slate-500">{lead.phone || lead.email || "No contact info"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Tag className="h-3 w-3 text-slate-400" />
                            <span className="text-xs font-bold text-slate-600">{leadStatus(lead)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", urgency.bg, urgency.color)}>
                            <AlertCircle className="h-2.5 w-2.5" />
                            {urgency.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-bold uppercase tracking-tighter text-slate-400">{activityLabel(lead)}</td>
                        <td className="px-6 py-4 text-right">
                          <button className={cn(
                            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                            lead.frontDesk?.frontDeskPriority === "urgent"
                              ? "bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary/90"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}>
                            {leadRecommendedAction(lead)}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td className="px-6 py-10 text-sm text-slate-500" colSpan={5}>No leads match this search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="hidden w-96 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-slate-50/30 xl:flex">
          {selectedLead ? (
            <>
              <div className="border-b border-slate-200 bg-white p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-extrabold text-primary shadow-sm">
                    {initials(leadName(selectedLead))}
                  </div>
                  <div className="flex gap-2">
                    <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-primary hover:text-primary"><Phone className="h-4 w-4" /></button>
                    <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-primary hover:text-primary"><MessageSquare className="h-4 w-4" /></button>
                  </div>
                </div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{leadName(selectedLead)}</h2>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Lead via {leadSource(selectedLead)} - {activityLabel(selectedLead)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", leadUrgency(selectedLead.frontDesk?.frontDeskPriority).bg, leadUrgency(selectedLead.frontDesk?.frontDeskPriority).color)}>
                    <AlertCircle className="h-2.5 w-2.5" />
                    {leadUrgency(selectedLead.frontDesk?.frontDeskPriority).label} Urgency
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <Tag className="h-2.5 w-2.5" />
                    {leadStatus(selectedLead)}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-8 overflow-y-auto p-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Operator Context</h4>
                  </div>
                  <p className="text-sm font-medium italic leading-relaxed text-slate-700">&ldquo;{leadSummary(selectedLead)}&rdquo;</p>
                </div>

                <div>
                  <h3 className="mb-4 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Lead Details</h3>
                  <div className="space-y-4 px-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 shadow-sm"><Phone className="h-3.5 w-3.5" /></div>
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
                        <p className="text-xs font-bold text-slate-900">{selectedLead.phone || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 shadow-sm"><Mail className="h-3.5 w-3.5" /></div>
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Email</p>
                        <p className="text-xs font-bold text-slate-900">{selectedLead.email || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 shadow-sm"><User className="h-3.5 w-3.5" /></div>
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Source</p>
                        <p className="text-xs font-bold text-slate-900">{leadSource(selectedLead)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="mb-4 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Primary Action</h3>
                  <div className="space-y-3">
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90">
                      <Phone className="h-4 w-4" />
                      {leadRecommendedAction(selectedLead)}
                    </button>
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50">
                      <Calendar className="h-4 w-4" />
                      Book Appointment
                    </button>
                    {selectedLead.latestMessageThreadId ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link href={`/app/messages?threadId=${encodeURIComponent(selectedLead.latestMessageThreadId)}`}>Open inbox thread</Link>
                      </Button>
                    ) : null}
                    {selectedLead.latestAppointmentRequestId ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link href={`/app/appointments?requestId=${encodeURIComponent(selectedLead.latestAppointmentRequestId)}`}>Open booking request</Link>
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" disabled={savingStage === "NEEDS_SCHEDULING"} onClick={() => void setStage("NEEDS_SCHEDULING")}>
                          Schedule
                        </Button>
                        <Button variant="outline" disabled={savingStage === "COMPLETED"} onClick={() => void setStage("COMPLETED")}>
                          Resolve
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-10 text-sm text-slate-500">Select a lead to review its context and next step.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
