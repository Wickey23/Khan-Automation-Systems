"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLead, updateLead } from "@/lib/api";
import type { Lead, LeadStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/site/toast-provider";

const statuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

export function LeadDetailForm({ lead }: { lead: Lead }) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [tags, setTags] = useState(lead.tags || "");
  const [notes, setNotes] = useState(lead.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  async function onSave() {
    setIsSaving(true);
    try {
      await updateLead(lead.id, { status, tags, notes });
      showToast({ title: "Lead updated", description: "Changes saved successfully." });
      router.refresh();
    } catch (error) {
      showToast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this lead?")) return;
    const password = window.prompt("Enter delete password:");
    if (!password) return;
    try {
      await deleteLead(lead.id, password);
      showToast({ title: "Lead deleted" });
      router.push("/admin/leads");
    } catch (error) {
      showToast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{lead.business}</CardTitle>
        <p className="text-sm text-muted-foreground">Captured on {formatDate(lead.createdAt)}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{lead.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{lead.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="font-medium">{lead.phone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Source</p>
            <p className="font-medium">{lead.sourcePage || "-"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as LeadStatus)}
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
          <Button variant="outline" onClick={onDelete}>
            Delete lead
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
