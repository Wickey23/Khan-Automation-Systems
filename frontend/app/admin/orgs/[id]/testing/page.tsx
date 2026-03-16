"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

  const load = useCallback(async () => {
    const data = await fetchAdminTesting(id);
    setScenarios(data.scenarios);
    setSummary(data.summary);
  }, [id]);

  useEffect(() => {
    void load().catch(() => {
      setScenarios([]);
      setSummary(null);
    });
  }, [load]);

  const completion = useMemo(() => {
    const latest = scenarios.map((scenario) => scenario.testRuns[0]?.status || "NONE");
    return latest.filter((status) => status === "PASS").length;
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
      <div className="page-shell space-y-6">
        <AdminTopTabs backFallbackHref={`/admin/orgs/${id}`} />

        <section className="rounded-[18px] border border-slate-300 bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Link href={`/admin/orgs/${id}`} className="text-primary hover:underline">
                  Organizations
                </Link>
                <span>/</span>
                <span>Testing & Simulator</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">AI Receptionist Simulator</h1>
              <p className="max-w-3xl text-sm text-slate-600">
                Diagnostic environment for scenario runs, validation notes, and final readiness before go-live.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void load()}>
                Scenario History
              </Button>
              <Button asChild>
                <Link href={`/admin/orgs/${id}`}>Deploy Config</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-[18px] border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Test Session</h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                  Active
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Completion</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-slate-950">
                    {completion}/{scenarios.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Passed</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-slate-950">{summary?.totalPassed ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">After-Hours</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{summary?.hasAfterHoursPass ? "PASS" : "MISSING"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Transfer</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{summary?.hasTransferPass ? "PASS" : "MISSING"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Quick Scenarios</h2>
              <div className="mt-4 space-y-3">
                {scenarios.slice(0, 3).map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-white"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{scenario.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{scenario.expectedOutcome}</p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Ready</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-slate-300 bg-slate-950 text-slate-100 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-500/60" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/60" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
                </div>
                <span className="text-xs font-mono text-slate-400">live_feed_v2.log</span>
              </div>
              <Button variant="outline" size="sm" className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => void load()}>
                Refresh
              </Button>
            </div>

            <div className="space-y-4 p-5">
              {scenarios.map((scenario) => {
                const latest = scenario.testRuns[0] || null;
                const statusTone =
                  latest?.status === "PASS"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : latest?.status === "FAIL"
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-slate-800 bg-slate-900/70";

                return (
                  <section key={scenario.id} className={`rounded-2xl border p-4 ${statusTone}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Scenario</span>
                          <span className="text-xs text-slate-500">{scenario.tagsJson || "default"}</span>
                        </div>
                        <h3 className="text-base font-semibold text-white">{scenario.name}</h3>
                        <p className="text-sm leading-6 text-slate-300">{scenario.script}</p>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Expected: {scenario.expectedOutcome}</p>
                        <p className="text-xs text-slate-400">
                          Latest result: {latest?.status || "No run yet"}
                          {latest?.createdAt ? ` • ${new Date(latest.createdAt).toLocaleString()}` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
                          latest?.status === "PASS"
                            ? "bg-emerald-100 text-emerald-700"
                            : latest?.status === "FAIL"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {latest?.status || "Pending"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_auto]">
                      <Input
                        className="border-slate-700 bg-slate-900 text-slate-100"
                        placeholder="Provider call ID"
                        value={callIdByScenario[scenario.id] || ""}
                        onChange={(event) => setCallIdByScenario((current) => ({ ...current, [scenario.id]: event.target.value }))}
                      />
                      <Textarea
                        className="min-h-[90px] border-slate-700 bg-slate-900 text-slate-100"
                        placeholder="Operator notes"
                        value={notesByScenario[scenario.id] || ""}
                        onChange={(event) => setNotesByScenario((current) => ({ ...current, [scenario.id]: event.target.value }))}
                      />
                      <div className="flex gap-2 lg:flex-col">
                        <Button disabled={busyScenarioId === scenario.id} onClick={() => void submitRun(scenario.id, "PASS")}>
                          Mark PASS
                        </Button>
                        <Button
                          variant="outline"
                          className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                          disabled={busyScenarioId === scenario.id}
                          onClick={() => void submitRun(scenario.id, "FAIL")}
                        >
                          Mark FAIL
                        </Button>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </AdminGuard>
  );
}
