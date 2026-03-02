"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AdminGuard } from "@/components/dashboard/admin-guard";
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
      <div className="container py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link href={`/admin/orgs/${id}`} className="text-sm text-primary">
              Back to org
            </Link>
            <h1 className="mt-2 text-3xl font-bold">Testing Harness</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete at least 5 PASS runs including after-hours and transfer scenarios.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-white p-3 text-sm">Completed: {completion}</div>
          <div className="rounded-lg border bg-white p-3 text-sm">PASS: {summary?.totalPassed ?? 0}</div>
          <div className="rounded-lg border bg-white p-3 text-sm">
            After-hours: {summary?.hasAfterHoursPass ? "PASS" : "MISSING"}
          </div>
          <div className="rounded-lg border bg-white p-3 text-sm">
            Transfer: {summary?.hasTransferPass ? "PASS" : "MISSING"}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {scenarios.map((scenario) => {
            const latest = scenario.testRuns[0] || null;
            return (
              <section key={scenario.id} className="rounded-lg border bg-white p-4">
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
      </div>
    </AdminGuard>
  );
}

