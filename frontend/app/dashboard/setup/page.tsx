"use client";

import { useEffect, useState } from "react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchClientWorkspace, updateClientSettings } from "@/lib/api";
import type { Client } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function DashboardSetupPage() {
  const { showToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessHoursJson, setBusinessHoursJson] = useState("{\"timezone\":\"America/New_York\",\"schedule\":{}}");
  const [transferNumber, setTransferNumber] = useState("");
  const [servicesJson, setServicesJson] = useState("[]");
  const [bookingLink, setBookingLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchClientWorkspace();
        if (!active) return;
        setClient(data.client);
        setBusinessName(data.client.name);
        setBusinessHoursJson(data.client.setting?.businessHoursJson || "{\"timezone\":\"America/New_York\",\"schedule\":{}}");
        setTransferNumber(data.client.setting?.transferNumber || "");
        setServicesJson(data.client.setting?.servicesJson || "[]");
        setBookingLink(data.client.setting?.bookingLink || "");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function onSave() {
    if (!transferNumber.trim()) {
      showToast({ title: "Transfer number is required.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      await updateClientSettings({
        name: businessName,
        businessHoursJson,
        transferNumber,
        servicesJson,
        bookingLink: bookingLink || null
      });
      showToast({ title: "Setup saved" });
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
    <ClientGuard>
      <div className="container max-w-3xl py-10">
        <h1 className="text-3xl font-bold">Setup Wizard</h1>
        {client && !client.phoneLine?.phoneNumber ? (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Your number is being assigned by our team. Status: {client.status}.
          </div>
        ) : null}
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <Label>Business Name</Label>
              <Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
            </div>
            <div>
              <Label>Business Hours JSON</Label>
              <Textarea value={businessHoursJson} onChange={(event) => setBusinessHoursJson(event.target.value)} />
            </div>
            <div>
              <Label>Transfer Number (required)</Label>
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
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save setup"}
            </Button>
          </div>
        )}
      </div>
    </ClientGuard>
  );
}
