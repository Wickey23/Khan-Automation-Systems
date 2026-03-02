"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/site/toast-provider";
import { fetchAdminDemoConfig, updateAdminDemoConfig } from "@/lib/api";

export default function AdminDemoPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demoNumber, setDemoNumber] = useState("");
  const [demoTitle, setDemoTitle] = useState("Voice Demo (Call From Your Phone)");
  const [demoSubtitle, setDemoSubtitle] = useState(
    "Call the demo line and ask questions naturally. The assistant responds live."
  );
  const [demoQuestionsText, setDemoQuestionsText] = useState(
    "What services do you offer?\nWhat are your hours?\nCan I schedule an appointment?"
  );

  useEffect(() => {
    let active = true;
    void fetchAdminDemoConfig()
      .then((data) => {
        if (!active) return;
        setDemoNumber(data.demoNumber || "");
        setDemoTitle(data.demoTitle || "Voice Demo (Call From Your Phone)");
        setDemoSubtitle(
          data.demoSubtitle || "Call the demo line and ask questions naturally. The assistant responds live."
        );
        setDemoQuestionsText(
          (data.demoQuestions?.length
            ? data.demoQuestions
            : [
                "What services do you offer?",
                "What are your hours?",
                "Can I schedule an appointment?"
              ]
          ).join("\n")
        );
      })
      .catch((error) => {
        if (!active) return;
        showToast({
          title: "Failed to load demo settings",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  async function onSave() {
    setSaving(true);
    try {
      const demoQuestions = demoQuestionsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 12);

      await updateAdminDemoConfig({
        demoNumber: demoNumber.trim(),
        demoTitle: demoTitle.trim(),
        demoSubtitle: demoSubtitle.trim(),
        demoQuestions
      });

      showToast({
        title: "Demo config saved",
        description: "Homepage voice demo now uses these settings."
      });
    } catch (error) {
      showToast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard>
      <div className="container py-10">
        <AdminTopTabs className="mb-3" />
        <h1 className="text-3xl font-bold">Demo Configuration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the public voice demo block shown on the landing page.
        </p>

        <div className="mt-5 rounded-lg border bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Demo phone number (E.164)</label>
              <Input
                value={demoNumber}
                onChange={(event) => setDemoNumber(event.target.value)}
                placeholder="+15163505753"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Demo title</label>
              <Input value={demoTitle} onChange={(event) => setDemoTitle(event.target.value)} disabled={loading} />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Demo subtitle</label>
            <Textarea
              value={demoSubtitle}
              onChange={(event) => setDemoSubtitle(event.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Suggested questions (one per line)</label>
            <Textarea
              value={demoQuestionsText}
              onChange={(event) => setDemoQuestionsText(event.target.value)}
              rows={5}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              These are shown as prompts to help visitors test the call demo.
            </p>
          </div>

          <div className="mt-5">
            <Button onClick={() => void onSave()} disabled={loading || saving}>
              {saving ? "Saving..." : "Save demo config"}
            </Button>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}

