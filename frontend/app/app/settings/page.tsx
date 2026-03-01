"use client";

import { useEffect, useState } from "react";
import { fetchOrgProfile, updateOrgProfile } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AppSettingsPage() {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchOrgProfile()
      .then((data) => {
        setName(data.organization.name || "");
        setIndustry(data.organization.industry || "");
      })
      .catch(() => null);
  }, []);

  async function onSave() {
    setSaving(true);
    try {
      await updateOrgProfile({ name, industry: industry || null });
      showToast({ title: "Settings updated" });
    } catch (error) {
      showToast({ title: "Update failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Organization Settings</h1>
      <div>
        <Label>Organization Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Industry</Label>
        <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
      </div>
      <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
    </div>
  );
}
