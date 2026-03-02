"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import {
  convertProspectToLead,
  createProspect,
  discoverProspects,
  fetchProspects,
  importProspectsCsv,
  scoreProspect,
  updateProspect
} from "@/lib/api";
import type { Prospect, ProspectStatus } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const statusOptions: ProspectStatus[] = ["NEW", "QUALIFIED", "CONTACTED", "NURTURE", "WON", "LOST"];

export default function AdminProspectsPage() {
  const { showToast } = useToast();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [status, setStatus] = useState<"ALL" | ProspectStatus>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [csvInput, setCsvInput] = useState("");
  const [discoverLocation, setDiscoverLocation] = useState("");
  const [discoverKeywords, setDiscoverKeywords] = useState(
    "truck repair shop,auto repair shop,hvac contractor,equipment repair service,manufacturing service"
  );
  const [discoverLimit, setDiscoverLimit] = useState(30);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "150");
    if (status !== "ALL") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    return `?${params.toString()}`;
  }, [search, status]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchProspects(query);
        if (!active) return;
        setProspects(data.prospects);
      } catch (error) {
        if (!active) return;
        showToast({
          title: "Failed to load prospects",
          description: error instanceof Error ? error.message : "Request failed.",
          variant: "error"
        });
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [query, showToast]);

  async function addProspect() {
    if (!name.trim() || !business.trim()) return;
    try {
      await createProspect({
        name: name.trim(),
        business: business.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null
      });
      setName("");
      setBusiness("");
      setEmail("");
      setPhone("");
      const data = await fetchProspects(query);
      setProspects(data.prospects);
      showToast({ title: "Prospect added" });
    } catch (error) {
      showToast({
        title: "Failed to add prospect",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    }
  }

  async function runImport() {
    if (!csvInput.trim()) return;
    try {
      const result = await importProspectsCsv(csvInput);
      const data = await fetchProspects(query);
      setProspects(data.prospects);
      showToast({ title: "CSV imported", description: `${result.createdCount} prospects added.` });
    } catch (error) {
      showToast({
        title: "CSV import failed",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    }
  }

  async function runDiscover() {
    setDiscovering(true);
    try {
      const keywords = discoverKeywords
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const result = await discoverProspects({
        location: discoverLocation.trim(),
        keywords: keywords.length ? keywords : undefined,
        limit: discoverLimit
      });
      const data = await fetchProspects(query);
      setProspects(data.prospects);
      showToast({
        title: "Discovery completed",
        description: `Imported ${result.createdCount} prospects.`
      });
    } catch (error) {
      showToast({
        title: "Discovery failed",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setDiscovering(false);
    }
  }

  async function patchStatus(id: string, nextStatus: ProspectStatus) {
    setBusyId(id);
    try {
      await updateProspect(id, { status: nextStatus });
      setProspects((current) => current.map((row) => (row.id === id ? { ...row, status: nextStatus } : row)));
    } catch (error) {
      showToast({
        title: "Status update failed",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setBusyId(null);
    }
  }

  async function runScore(id: string) {
    setBusyId(id);
    try {
      const result = await scoreProspect(id);
      setProspects((current) => current.map((row) => (row.id === id ? result.prospect : row)));
    } catch (error) {
      showToast({
        title: "Scoring failed",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setBusyId(null);
    }
  }

  async function runConvert(id: string) {
    setBusyId(id);
    try {
      const result = await convertProspectToLead(id);
      setProspects((current) => current.map((row) => (row.id === id ? result.prospect : row)));
      showToast({ title: "Converted to lead", description: `Lead ${result.lead.id} created.` });
    } catch (error) {
      showToast({
        title: "Convert failed",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminGuard>
      <div className="container py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Prospects</h1>
            <p className="text-sm text-muted-foreground">Lead Finder workspace for discovering and qualifying businesses.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/admin/orgs" className="text-primary">Organizations</Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/admin/calls" className="text-primary">Calls</Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/admin/leads" className="text-primary">Leads</Link>
          </div>
        </div>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold">Add prospect</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Business" value={business} onChange={(e) => setBusiness(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button className="mt-3" onClick={() => void addProspect()}>Add prospect</Button>
        </section>

        <section className="mt-4 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold">Auto-discover businesses</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Finds businesses likely to benefit from AI reception and imports them as prospects. Leave fields blank to run broad discovery.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Location (optional, defaults to United States)"
              value={discoverLocation}
              onChange={(e) => setDiscoverLocation(e.target.value)}
            />
            <Input
              placeholder="Keywords (optional, comma-separated)"
              value={discoverKeywords}
              onChange={(e) => setDiscoverKeywords(e.target.value)}
              className="sm:col-span-2"
            />
            <Input
              type="number"
              min={1}
              max={100}
              value={discoverLimit}
              onChange={(e) => setDiscoverLimit(Math.max(1, Math.min(100, Number(e.target.value) || 30)))}
            />
          </div>
          <Button className="mt-3" variant="outline" disabled={discovering} onClick={() => void runDiscover()}>
            {discovering ? "Searching..." : "Auto-discover prospects"}
          </Button>
        </section>

        <section className="mt-4 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold">Import CSV</h2>
          <p className="mt-1 text-xs text-muted-foreground">Header example: name,business,email,phone,website,industry,city,state,notes,tags</p>
          <Textarea
            className="mt-2 min-h-[120px]"
            placeholder="name,business,email,phone&#10;Jane Doe,Acme HVAC,jane@acme.com,+15165550123"
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
          />
          <Button className="mt-3" variant="outline" onClick={() => void runImport()}>
            Import CSV text
          </Button>
        </section>

        <section className="mt-4 rounded-lg border bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as "ALL" | ProspectStatus)}
            >
              <option value="ALL">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <Input
              placeholder="Search name/business/email/phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" onClick={() => void fetchProspects(query).then((d) => setProspects(d.prospects))}>
              Refresh
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2">Business</th>
                  <th className="p-2">Contact</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((prospect) => (
                  <tr key={prospect.id} className="border-t">
                    <td className="p-2">
                      <p className="font-medium">{prospect.business}</p>
                      <p className="text-xs text-muted-foreground">{prospect.name}</p>
                    </td>
                    <td className="p-2 text-xs">
                      <p>{prospect.email || "-"}</p>
                      <p>{prospect.phone || "-"}</p>
                    </td>
                    <td className="p-2">{prospect.score ?? "-"}</td>
                    <td className="p-2">
                      <select
                        className="h-8 rounded-md border border-input bg-white px-2 text-xs"
                        value={prospect.status}
                        onChange={(e) => void patchStatus(prospect.id, e.target.value as ProspectStatus)}
                        disabled={busyId === prospect.id}
                      >
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">{prospect.source}</td>
                    <td className="p-2">{new Date(prospect.createdAt).toLocaleDateString()}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" disabled={busyId === prospect.id} onClick={() => void runScore(prospect.id)}>
                          Score
                        </Button>
                        <Button size="sm" disabled={busyId === prospect.id} onClick={() => void runConvert(prospect.id)}>
                          Convert
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!prospects.length && !loading ? (
                  <tr>
                    <td className="p-2 text-muted-foreground" colSpan={7}>
                      No prospects found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminGuard>
  );
}
