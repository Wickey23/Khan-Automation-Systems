"use client";

import { useEffect, useState } from "react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchClientWorkspace, updateClientSettings } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";

export default function DashboardSettingsPage() {
  const [businessHoursJson, setBusinessHoursJson] = useState("");
  const [transferNumber, setTransferNumber] = useState("");
  const [servicesJson, setServicesJson] = useState("");
  const [bookingLink, setBookingLink] = useState("");
  const [paused, setPaused] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    void fetchClientWorkspace()
      .then((data) => {
        setBusinessHoursJson(data.client.setting?.businessHoursJson || "");
        setTransferNumber(data.client.setting?.transferNumber || "");
        setServicesJson(data.client.setting?.servicesJson || "");
        setBookingLink(data.client.setting?.bookingLink || "");
        setPaused(Boolean(data.client.setting?.paused));
      })
      .catch(() => null);
  }, []);

  async function onSave() {
    try {
      await updateClientSettings({
        businessHoursJson,
        transferNumber,
        servicesJson,
        bookingLink: bookingLink || null,
        paused
      });
      showToast({ title: "Settings updated" });
    } catch (error) {
      showToast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  return (
    <ClientGuard>
      <PageShell className="space-y-6">
        <PageHeader
          eyebrow="Legacy settings"
          title="Workspace settings"
          description="Directly manage raw workspace configuration values."
        />
        <SectionShell className="surface-panel space-y-4">
          <div>
            <Label>Business Hours JSON</Label>
            <Textarea value={businessHoursJson} onChange={(event) => setBusinessHoursJson(event.target.value)} />
          </div>
          <div>
            <Label>Transfer Number</Label>
            <Input value={transferNumber} onChange={(event) => setTransferNumber(event.target.value)} />
          </div>
          <div>
            <Label>Services JSON</Label>
            <Textarea value={servicesJson} onChange={(event) => setServicesJson(event.target.value)} />
          </div>
          <div>
            <Label>Booking Link</Label>
            <Input value={bookingLink} onChange={(event) => setBookingLink(event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
            Pause call handling
          </label>
          <Button onClick={onSave}>Save settings</Button>
        </SectionShell>
      </PageShell>
    </ClientGuard>
  );
}
