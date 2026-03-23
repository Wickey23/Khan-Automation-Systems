"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchOrgConfigPackage } from "@/lib/api";
import type { ConfigPackage } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";

export default function AppOnboardingPreviewPage() {
  const [configPackage, setConfigPackage] = useState<ConfigPackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchOrgConfigPackage()
      .then((data) => setConfigPackage(data.configPackage))
      .catch(() => setConfigPackage(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Setup package"
        title="Build Sheet Preview"
        description="Canonical AI configuration package generated from your onboarding answers."
        actions={
          <Link href="/app/onboarding">
            <Button variant="outline">Return to onboarding</Button>
          </Link>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Package version</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{configPackage?.version || "-"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Generated</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {configPackage?.generatedAt ? new Date(configPackage.generatedAt).toLocaleString() : loading ? "Loading..." : "Not available"}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/70">
          <CardTitle>Generated configuration payload</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {loading ? (
            <p className="text-sm text-slate-600">Loading configuration package...</p>
          ) : configPackage ? (
            <pre className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(configPackage.json, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-slate-600">
              No config package yet. Save onboarding first, then generate a preview.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
