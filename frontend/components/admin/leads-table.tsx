"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Save, Trash2 } from "lucide-react";
import { deleteLead, updateLead } from "@/lib/api";
import type { Lead, LeadStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/site/toast-provider";

const statusVariant: Record<LeadStatus, "default" | "secondary" | "outline"> = {
  NEW: "default",
  CONTACTED: "secondary",
  QUALIFIED: "secondary",
  WON: "default",
  LOST: "outline"
};

const statusOptions: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

export function LeadsTable({
  leads,
  deletePassword,
  onDeleted
}: {
  leads: Lead[];
  deletePassword: string;
  onDeleted: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<string, LeadStatus>>({});
  const [tagsById, setTagsById] = useState<Record<string, string>>({});
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const normalized = useMemo(
    () =>
      leads.map((lead) => ({
        ...lead,
        status: statusById[lead.id] || lead.status,
        tags: tagsById[lead.id] ?? lead.tags ?? "",
        notes: notesById[lead.id] ?? lead.notes ?? ""
      })),
    [leads, notesById, statusById, tagsById]
  );

  async function copyToClipboard(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    showToast({ title: `${label} copied`, description: value });
  }

  async function saveLead(lead: Lead) {
    setSavingId(lead.id);
    try {
      await updateLead(lead.id, {
        status: statusById[lead.id] || lead.status,
        tags: tagsById[lead.id] ?? lead.tags ?? "",
        notes: notesById[lead.id] ?? lead.notes ?? ""
      });
      showToast({ title: "Lead updated", description: `${lead.business} saved.` });
    } catch (error) {
      showToast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSavingId(null);
    }
  }

  async function removeLead(lead: Lead) {
    if (!deletePassword.trim()) {
      showToast({ title: "Delete password required", description: "Enter delete password first.", variant: "error" });
      return;
    }
    if (!window.confirm(`Delete lead for ${lead.business}?`)) return;
    setSavingId(lead.id);
    try {
      await deleteLead(lead.id, deletePassword);
      await onDeleted();
      showToast({ title: "Lead deleted" });
    } catch (error) {
      showToast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Created</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Business</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead>Industry</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {normalized.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell>{formatDate(lead.createdAt)}</TableCell>
            <TableCell>
              <p className="font-medium">{lead.name}</p>
              <p className="text-xs text-muted-foreground">{lead.email}</p>
            </TableCell>
            <TableCell>{lead.business}</TableCell>
            <TableCell>
              <div className="space-y-1">
                <Badge variant={statusVariant[lead.status]}>{lead.status}</Badge>
                <select
                  className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs"
                  value={lead.status}
                  onChange={(event) =>
                    setStatusById((prev) => ({
                      ...prev,
                      [lead.id]: event.target.value as LeadStatus
                    }))
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </TableCell>
            <TableCell>
              <Input
                className="h-9 min-w-36 text-xs"
                placeholder="truck shop, urgent"
                value={lead.tags || ""}
                onChange={(event) =>
                  setTagsById((prev) => ({
                    ...prev,
                    [lead.id]: event.target.value
                  }))
                }
              />
            </TableCell>
            <TableCell>
              <Textarea
                className="min-h-[70px] min-w-52 text-xs"
                placeholder="Call notes + follow-up date"
                value={lead.notes || ""}
                onChange={(event) =>
                  setNotesById((prev) => ({
                    ...prev,
                    [lead.id]: event.target.value
                  }))
                }
              />
            </TableCell>
            <TableCell>{lead.industry || "-"}</TableCell>
            <TableCell>{lead.sourcePage || "-"}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  disabled={savingId === lead.id}
                  onClick={() => void saveLead(lead)}
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(lead.email, "Email")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(lead.phone, "Phone")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/leads/${lead.id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button variant="outline" size="sm" disabled={savingId === lead.id} onClick={() => void removeLead(lead)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
