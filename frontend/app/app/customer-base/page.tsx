"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchCustomerBase, getBillingStatus, importCustomerBase } from "@/lib/api";
import type { CustomerBaseRecord } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { InfoHint } from "@/components/ui/info-hint";
import { PageHeader } from "@/components/ui/page";
import { frontDeskEmptyStateClass, frontDeskLoadingCardClass, frontDeskMetricCardClass, frontDeskSkeletonLineClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";
import { resolvePlanFeatures } from "@/lib/plan-features";

function formatOutcome(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "No outcome logged";
  if (normalized === "N/A" || normalized === "NA" || normalized === "UNKNOWN") return "No outcome logged";
  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getDisplayEmail(value: string | null | undefined) {
  const email = String(value || "").trim();
  if (!email) return "";
  if (email.toLowerCase().endsWith("@no-email.local")) return "No email provided";
  return email;
}

export default function CustomerBasePage() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<CustomerBaseRecord[]>([]);
  const [canAccess, setCanAccess] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<{ total: number; vip: number; withLead: number; repeatCallers: number } | null>(
    null
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    void Promise.all([getBillingStatus(), fetchCustomerBase()])
      .then(([billing, data]) => {
        const features = resolvePlanFeatures({
          plan: billing.subscription?.plan,
          status: billing.subscription?.status
        });
        const hasProCustomerBase = features.proEnabled;
        setCanAccess(hasProCustomerBase);
        if (!hasProCustomerBase) return;
        setCustomers(data.customers || []);
        setSummary(data.summary || null);
      })
      .catch(() => setCanAccess(false))
      .finally(() => setLoading(false));
  }, []);

  async function parseCustomerFile(file: File): Promise<Array<Record<string, unknown>>> {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".csv")) {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length < 2) return [];
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows: Array<Record<string, unknown>> = [];
      for (let i = 1; i < lines.length; i += 1) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const row: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          row[h] = cols[idx] || "";
        });
        rows.push(row);
      }
      return rows;
    }

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) return [];
      const sheet = workbook.Sheets[firstSheet];
      return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    }

    throw new Error("Unsupported file type. Use .xlsx, .xls, or .csv.");
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const rows = await parseCustomerFile(file);
      if (!rows.length) {
        showToast({ title: "No rows found", description: "The file appears empty.", variant: "error" });
        return;
      }
      const result = await importCustomerBase(rows, file.name);
      const latest = await fetchCustomerBase();
      setCustomers(latest.customers || []);
      setSummary(latest.summary || null);
      showToast({
        title: "Customer base imported",
        description: `Imported ${result.imported}, skipped ${result.skipped}, profiles ${result.updatedProfiles}, leads ${result.updatedLeads}.`
      });
    } catch (error) {
      showToast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Try another file.",
        variant: "error"
      });
    } finally {
      setImporting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => {
      const haystack = [
        customer.phoneNumber,
        customer.lead?.name || "",
        customer.lead?.business || "",
        customer.lead?.email || "",
        customer.lastOutcome || "",
        customer.recentCalls[0]?.aiSummary || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [customers, query]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Customer memory"
        title="Customer Memory"
        description="Use this page to recognize repeat callers quickly. It shows known customer context, linked lead records, and recent history that should shape follow-up."
      />

      <div className={`${frontDeskEmptyStateClass()} text-left`}>
        Customer Memory becomes more valuable over time. As repeat callers contact the business, this page helps the office recognize who they are, what happened last time, and whether they already have a linked lead profile.
      </div>

      {canAccess === false ? (
        <div className={`${frontDeskWorkspaceCardClass("subtle")} p-6`}>
          <h2 className="text-lg font-semibold">Customer Memory is a Pro workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Standard focuses on lead pipeline management. Pro unlocks caller memory, repeat-caller context, and bulk customer-memory
            imports.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app/leads" className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm font-medium shadow-[0_10px_22px_rgba(15,23,42,0.05)] transition hover:bg-slate-50">
              Open Leads (Standard)
            </Link>
            <Link href="/app/billing" className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
              Upgrade to Pro
            </Link>
          </div>
        </div>
      ) : null}

      {canAccess === false ? null : (
        <>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${frontDeskMetricCardClass()} p-4`}>
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Total People
            <InfoHint text="Unique caller records detected for this organization by normalized phone number." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{summary?.total ?? "-"}</p>
        </div>
        <div className={`${frontDeskMetricCardClass()} p-4`}>
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Repeat Callers
            <InfoHint text="Callers with more than one recorded call in caller profiles." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{summary?.repeatCallers ?? "-"}</p>
        </div>
        <div className={`${frontDeskMetricCardClass()} p-4`}>
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            With Lead Profile
            <InfoHint text="Caller records currently linked to a CRM lead profile." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{summary?.withLead ?? "-"}</p>
        </div>
        <div className={`${frontDeskMetricCardClass()} p-4`}>
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            VIP Flagged
            <InfoHint text="Caller profiles flagged as VIP for priority handling logic." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{summary?.vip ?? "-"}</p>
        </div>
      </div>

      <div className={`${frontDeskWorkspaceCardClass("subtle")} p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="inline-flex items-center gap-1 font-semibold">
              Import Customer Base
              <InfoHint text="Bulk import creates or updates caller profiles and lead records from CSV/Excel rows." />
            </h2>
            <p className="text-xs text-muted-foreground">Upload Excel (.xlsx/.xls) or CSV with customer phone/name/details.</p>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={importing}
            onChange={(event) => void onImportFile(event.target.files?.[0] || null)}
            className="max-w-xs text-sm"
          />
        </div>

        <label className="inline-flex items-center gap-1 text-sm font-medium">
          Search
          <InfoHint text="Search matches phone, name, business, email, outcome, and recent summary text." />
        </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
            placeholder="Phone, name, business, email, outcome..."
          />
      </div>

      <div className={`${frontDeskWorkspaceCardClass("default")} p-4`}>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={frontDeskLoadingCardClass()}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-2">
                    <div className={frontDeskSkeletonLineClass("md")} />
                    <div className={frontDeskSkeletonLineClass("sm")} />
                  </div>
                  <div className={frontDeskSkeletonLineClass("sm")} />
                </div>
                <div className="mt-3 space-y-2">
                  <div className={frontDeskSkeletonLineClass("full")} />
                  <div className={frontDeskSkeletonLineClass("lg")} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={frontDeskEmptyStateClass()}>
            No customer records yet. Returning callers, imported history, and lead-linked memory will appear here once the business starts building repeat-customer context.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((customer) => (
              <div key={customer.phoneNumber} className={`${frontDeskWorkspaceCardClass("subtle")} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{customer.displayName || "Unknown contact"}</p>
                  <p className="text-xs text-muted-foreground">{customer.phoneNumber}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Calls: {customer.totalCalls} | Last outcome: {formatOutcome(customer.lastOutcome)} | Last call:{" "}
                  {new Date(customer.lastCallAt).toLocaleString()}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  Name confidence: {customer.nameConfidence}
                  <InfoHint text="HIGH = explicit name captured; MEDIUM = inferred from reliable context; LOW = weak/no confirmed name." />
                </p>
                {customer.lead ? (
                  <p className="mt-1 text-sm">
                    {customer.lead.business}
                    {getDisplayEmail(customer.lead.email) ? ` | ${getDisplayEmail(customer.lead.email)}` : ""}
                  </p>
                ) : null}
                {customer.recentCalls[0]?.aiSummary ? (
                  <p className="mt-2 text-sm text-muted-foreground">Recent summary: {customer.recentCalls[0].aiSummary}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
