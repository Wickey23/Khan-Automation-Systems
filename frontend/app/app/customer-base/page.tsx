"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchCustomerBase, importCustomerBase } from "@/lib/api";
import type { CustomerBaseRecord } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";

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
  const [summary, setSummary] = useState<{ total: number; vip: number; withLead: number; repeatCallers: number } | null>(
    null
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetchCustomerBase()
      .then((data) => {
        setCustomers(data.customers || []);
        setSummary(data.summary || null);
      })
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
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Customer Base</h1>
        <p className="text-sm text-muted-foreground">
          Returning caller memory, lead linkage, and recent interaction context for your assistant.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total People</p>
          <p className="mt-1 text-2xl font-semibold">{summary?.total ?? "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Repeat Callers</p>
          <p className="mt-1 text-2xl font-semibold">{summary?.repeatCallers ?? "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">With Lead Profile</p>
          <p className="mt-1 text-2xl font-semibold">{summary?.withLead ?? "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">VIP Flagged</p>
          <p className="mt-1 text-2xl font-semibold">{summary?.vip ?? "-"}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Import Customer Base</h2>
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

        <label className="text-sm font-medium">Search</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm"
          placeholder="Phone, name, business, email, outcome..."
        />
      </div>

      <div className="rounded-lg border bg-white p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading customer base...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No customer records found yet.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((customer) => (
              <div key={customer.phoneNumber} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{customer.displayName || "Unknown contact"}</p>
                  <p className="text-xs text-muted-foreground">{customer.phoneNumber}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Calls: {customer.totalCalls} | Last outcome: {formatOutcome(customer.lastOutcome)} | Last call:{" "}
                  {new Date(customer.lastCallAt).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Name confidence: {customer.nameConfidence}</p>
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
    </div>
  );
}
