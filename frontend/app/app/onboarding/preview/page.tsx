"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchOrgConfigPackage } from "@/lib/api";
import type { ConfigPackage } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AppOnboardingPreviewPage() {
  const [configPackage, setConfigPackage] = useState<ConfigPackage | null>(null);

  useEffect(() => {
    void fetchOrgConfigPackage()
      .then((data) => setConfigPackage(data.configPackage))
      .catch(() => setConfigPackage(null));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/app/onboarding" className="text-sm text-primary">
          Back to onboarding
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Build Sheet Preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Canonical AI configuration package generated from your onboarding answers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Version {configPackage?.version || "-"}
            {configPackage?.generatedAt
              ? ` · Generated ${new Date(configPackage.generatedAt).toLocaleString()}`
              : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configPackage ? (
            <pre className="max-h-[70vh] overflow-auto rounded bg-muted p-3 text-xs">
              {JSON.stringify(configPackage.json, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No config package yet. Save onboarding first, then generate a preview.
            </p>
          )}
          <div className="mt-4">
            <Link href="/app/onboarding">
              <Button variant="outline">Return to onboarding</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
