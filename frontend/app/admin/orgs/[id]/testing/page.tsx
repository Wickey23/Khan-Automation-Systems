"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FlaskConical, History, Play, Shield } from "lucide-react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { createAdminTestRun, fetchAdminTesting } from "@/lib/api";
import type { TestScenario } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AdminOrgTestingPage() {
  const { id } = useParams<{ id: string }>();
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [callIdByScenario, setCallIdByScenario] = useState<Record<string, string>>({});
  const [notesByScenario, setNotesByScenario] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{ totalPassed: number; hasAfterHoursPass: boolean; hasTransferPass: boolean } | null>(null);
  const [busyScenarioId, setBusyScenarioId] = useState<string | null>(null);

  async function load() {
    const data = await fetchAdminTesting(id);
    setScenarios(data.scenarios);
    setSummary(data.summary);
  }

  useEffect(() => {
    void load().catch(() => {
      setScenarios([]);
      setSummary(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const completion = useMemo(() => {
    const latest = scenarios.map((scenario) => scenario.testRuns[0]?.status || "NONE");
    const pass = latest.filter((status) => status === "PASS").length;
    return `${pass}/${scenarios.length}`;
  }, [scenarios]);

  async function submitRun(scenarioId: string, status: "PASS" | "FAIL") {
    setBusyScenarioId(scenarioId);
    try {
      await createAdminTestRun(id, {
        scenarioId,
        status,
        providerCallId: callIdByScenario[scenarioId] || undefined,
        notes: notesByScenario[scenarioId] || undefined
      });
      await load();
    } finally {
      setBusyScenarioId(null);
    }
  }

  return (
    <AdminGuard>
      <div className="page-shell space-y-6 py-10">
        <AdminTopTabs className="mb-3" backFallbackHref={`/admin/orgs/${id}`} />

        <section className="overflow-hidden rounded-[30px] border border-slate-800 bg-slate-950 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-8 py-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <FlaskConical className="h-6 w-6" />
              </div>
              <div>
                <Link href={`/admin/orgs/${id}`} className="text-sm font-medium text-primary transition hover:text-sky-300">
                  Back to org
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Admin Testing Lab</span>
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight">AI Simulation Environment</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => void load()}>
                Refresh
              </Button>
              <Button className="rounded-2xl bg-primary px-5 shadow-lg shadow-sky-200/40 hover:bg-sky-500">
                <Play className="mr-2 h-4 w-4" />
                Run suite
              </Button>
            </div>
          </div>

          <div className="grid gap-4 px-8 py-6 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Completed</p>
              <p className="mt-2 text-2xl font-black">{completion}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Pass runs</p>
              <p className="mt-2 text-2xl font-black">{summary?.totalPassed ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">After-hours</p>
              <p className="mt-2 text-lg font-semibold">{summary?.hasAfterHoursPass ? "PASS" : "MISSING"}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Transfer</p>
              <p className="mt-2 text-lg font-semibold">{summary?.hasTransferPass ? "PASS" : "MISSING"}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-3">
          {scenarios.map((scenario) => {
            const latest = scenario.testRuns[0] || null;
            return (
              <section key={scenario.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{scenario.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{scenario.script}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Expected outcome: {scenario.expectedOutcome}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Latest: {latest?.status || "No run yet"}</p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      latest?.status === "PASS" ? "bg-emerald-100 text-emerald-700" : latest?.status === "FAIL" ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {latest?.status || "PENDING"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Provider call ID (optional)"
                    value={callIdByScenario[scenario.id] || ""}
                    onChange={(event) =>
                      setCallIdByScenario((current) => ({ ...current, [scenario.id]: event.target.value }))
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      disabled={busyScenarioId === scenario.id}
                      onClick={() => void submitRun(scenario.id, "PASS")}
                    >
                      Mark PASS
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busyScenarioId === scenario.id}
                      onClick={() => void submitRun(scenario.id, "FAIL")}
                    >
                      Mark FAIL
                    </Button>
                  </div>
                </div>
                <Textarea
                  className="mt-2"
                  placeholder="Notes"
                  value={notesByScenario[scenario.id] || ""}
                  onChange={(event) =>
                    setNotesByScenario((current) => ({ ...current, [scenario.id]: event.target.value }))
                  }
                />
              </section>
            );
          })}
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <History className="h-4 w-4 text-slate-400" />
            Test run guidance
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Complete at least 5 PASS runs including after-hours and transfer scenarios before advancing this workspace toward go-live.
          </p>
        </section>
      </div>
    </AdminGuard>
  );
}

