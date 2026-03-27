"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, FileCode2 } from "lucide-react";
import { fetchOrgConfigPackage } from "@/lib/api";
import type { ConfigPackage } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { frontDeskMetricCardClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";
import { useToast } from "@/components/site/toast-provider";

export default function AppOnboardingPreviewPage() {
  const { showToast } = useToast();
  const [configPackage, setConfigPackage] = useState<ConfigPackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchOrgConfigPackage()
      .then((data) => setConfigPackage(data.configPackage))
      .catch(() => setConfigPackage(null))
      .finally(() => setLoading(false));
  }, []);

  const configJson = configPackage ? JSON.stringify(configPackage.json, null, 2) : "";

  async function onCopyJson() {
    if (!configJson) return;
    try {
      await navigator.clipboard.writeText(configJson);
      showToast({ title: "Copied", description: "Configuration JSON copied to clipboard." });
    } catch {
      showToast({ title: "Copy failed", description: "Clipboard access was blocked.", variant: "error" });
    }
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Setup package"
        title="Build Sheet Preview"
        description="Canonical AI configuration package generated from onboarding answers. Use this as the source of truth for deployment, QA, and change review."
        actions={
          <div className="inline-flex rounded-2xl border bg-white p-1 shadow-sm">
            <Button type="button" size="sm" variant="ghost" onClick={() => void onCopyJson()} disabled={!configJson}>
              <Copy className="mr-1.5 h-4 w-4" />
              Copy JSON
            </Button>
            <Button asChild size="sm" variant="default">
              <Link href="/app/onboarding">Return to onboarding</Link>
            </Button>
          </div>
        }
      />

      <SectionShell className="surface-panel space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className={`${frontDeskMetricCardClass()} px-4 py-3`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Package version</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{configPackage?.version || "-"}</p>
          </div>
          <div className={`${frontDeskMetricCardClass()} px-4 py-3 md:col-span-2`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Generated</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {configPackage?.generatedAt ? new Date(configPackage.generatedAt).toLocaleString() : loading ? "Loading..." : "Not available"}
            </p>
          </div>
        </div>
        <div className={`${frontDeskWorkspaceCardClass("hero")} flex flex-wrap items-center justify-between gap-3 p-4`}>
          <div>
            <p className="page-eyebrow">Release handoff</p>
            <p className="mt-1 text-sm text-slate-700">Review this payload before promoting voice, lead, and outreach behavior changes into production.</p>
          </div>
          <span className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">
            {loading ? "Syncing package" : configPackage ? "Package ready" : "No package yet"}
          </span>
        </div>
      </SectionShell>

      <SectionShell className="surface-panel">
        <Card className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-200 bg-slate-50/70">
            <CardTitle className="inline-flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-slate-500" />
              Generated Configuration Payload
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {loading ? (
              <p className="text-sm text-slate-600">Loading configuration package...</p>
            ) : configPackage ? (
              <pre className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                {configJson}
              </pre>
            ) : (
              <p className="text-sm text-slate-600">
                No config package yet. Save onboarding first, then generate a preview.
              </p>
            )}
          </CardContent>
        </Card>
      </SectionShell>
    </PageShell>
  );
}

