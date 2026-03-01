"use client";

import { useEffect, useState } from "react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchClientWorkspace, updateClientSettings } from "@/lib/api";
import type { Client } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type DayHours = {
  enabled: boolean;
  start: string;
  end: string;
};
type HoursState = Record<DayKey, DayHours>;

const DEFAULT_HOURS: HoursState = {
  monday: { enabled: true, start: "08:00", end: "17:00" },
  tuesday: { enabled: true, start: "08:00", end: "17:00" },
  wednesday: { enabled: true, start: "08:00", end: "17:00" },
  thursday: { enabled: true, start: "08:00", end: "17:00" },
  friday: { enabled: true, start: "08:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "13:00" },
  sunday: { enabled: false, start: "09:00", end: "13:00" }
};

const DAY_ROWS: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" }
];

const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix"
];

function parseHoursState(raw: string | undefined | null): { timezone: string; hours: HoursState } {
  if (!raw) return { timezone: "America/New_York", hours: DEFAULT_HOURS };
  try {
    const parsed = JSON.parse(raw) as {
      timezone?: string;
      schedule?: Partial<Record<DayKey, { start?: string; end?: string }>>;
    };
    const timezone = parsed.timezone || "America/New_York";
    const next: HoursState = { ...DEFAULT_HOURS };
    DAY_ROWS.forEach(({ key }) => {
      const value = parsed.schedule?.[key];
      if (!value || !value.start || !value.end) {
        next[key] = { ...DEFAULT_HOURS[key], enabled: false };
      } else {
        next[key] = { enabled: true, start: value.start, end: value.end };
      }
    });
    return { timezone, hours: next };
  } catch {
    return { timezone: "America/New_York", hours: DEFAULT_HOURS };
  }
}

function parseServices(raw: string | undefined | null): string {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw) as string[];
    if (!Array.isArray(arr)) return "";
    return arr.join("\n");
  } catch {
    return "";
  }
}

export default function DashboardSetupPage() {
  const { showToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [hoursByDay, setHoursByDay] = useState<HoursState>(DEFAULT_HOURS);
  const [transferNumber, setTransferNumber] = useState("");
  const [servicesText, setServicesText] = useState("");
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
        const parsedHours = parseHoursState(data.client.setting?.businessHoursJson);
        setTimezone(parsedHours.timezone);
        setHoursByDay(parsedHours.hours);
        setTransferNumber(data.client.setting?.transferNumber || "");
        setServicesText(parseServices(data.client.setting?.servicesJson));
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

    const schedule = DAY_ROWS.reduce<Record<string, { start: string; end: string }>>((acc, row) => {
      const item = hoursByDay[row.key];
      if (item.enabled) acc[row.key] = { start: item.start, end: item.end };
      return acc;
    }, {});

    const servicesArray = servicesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await updateClientSettings({
        name: businessName,
        businessHoursJson: JSON.stringify({ timezone, schedule }),
        transferNumber,
        servicesJson: JSON.stringify(servicesArray),
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
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Business Hours</p>
              {DAY_ROWS.map((row) => {
                const value = hoursByDay[row.key];
                return (
                  <div key={row.key} className="grid gap-2 sm:grid-cols-[110px_90px_1fr_1fr] sm:items-center">
                    <p className="text-sm">{row.label}</p>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={value.enabled}
                        onChange={(event) =>
                          setHoursByDay((prev) => ({
                            ...prev,
                            [row.key]: { ...prev[row.key], enabled: event.target.checked }
                          }))
                        }
                      />
                      Open
                    </label>
                    <Input
                      type="time"
                      value={value.start}
                      disabled={!value.enabled}
                      onChange={(event) =>
                        setHoursByDay((prev) => ({
                          ...prev,
                          [row.key]: { ...prev[row.key], start: event.target.value }
                        }))
                      }
                    />
                    <Input
                      type="time"
                      value={value.end}
                      disabled={!value.enabled}
                      onChange={(event) =>
                        setHoursByDay((prev) => ({
                          ...prev,
                          [row.key]: { ...prev[row.key], end: event.target.value }
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
            <div>
              <Label>Transfer Number (required)</Label>
              <Input value={transferNumber} onChange={(event) => setTransferNumber(event.target.value)} placeholder="+15165551234" />
            </div>
            <div>
              <Label>Services (one per line)</Label>
              <Textarea
                value={servicesText}
                onChange={(event) => setServicesText(event.target.value)}
                placeholder={"Roadside Assistance\nFleet Diagnostics\nPreventive Maintenance"}
              />
            </div>
            <div>
              <Label>Booking Link</Label>
              <Input value={bookingLink} onChange={(event) => setBookingLink(event.target.value)} placeholder="https://..." />
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
