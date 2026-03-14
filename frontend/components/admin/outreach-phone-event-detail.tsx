"use client";

import type { OutreachPhoneEventDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata && typeof metadata[key] === "string" ? String(metadata[key]).trim() : "";
  return value || "";
}

export function OutreachPhoneEventDetailCard(input: {
  event: OutreachPhoneEventDetail;
  onClose?: () => void;
}) {
  const { event, onClose } = input;
  const metadata = event.metadata || null;
  const transcript = readMetadataString(metadata, "transcript");
  const recordingUrl = readMetadataString(metadata, "recordingUrl");
  const outcome = readMetadataString(metadata, "outcome");
  const callStatus = readMetadataString(metadata, "callStatus");

  return (
    <Card className="border-zinc-300 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Outreach call detail</CardTitle>
          <div className="mt-2 text-sm text-muted-foreground">
            {event.lead?.companyName || event.lead?.contactName || event.toPhone}
            {event.providerCallId ? ` · call ${event.providerCallId}` : ""}
            {` · ${new Date(event.createdAt).toLocaleString()}`}
          </div>
        </div>
        {onClose ? (
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Status</div>
            <div className="mt-2 text-sm font-medium">{event.eventType}{event.status ? ` · ${event.status}` : ""}</div>
            {event.errorMessage ? <div className="mt-2 text-xs text-red-700">{event.errorMessage}</div> : null}
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Lead</div>
            <div className="mt-2 text-sm font-medium">{event.lead?.contactName || event.lead?.companyName || "Unknown lead"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{event.toPhone}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Caller profile</div>
            <div className="mt-2 text-sm font-medium">{event.callerConfig?.name || "Unknown caller profile"}</div>
            {event.callerConfig?.timezone ? <div className="mt-1 text-xs text-muted-foreground">{event.callerConfig.timezone}</div> : null}
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Enrollment</div>
            <div className="mt-2 text-sm font-medium">{event.enrollment?.status || "No enrollment"}</div>
            {event.enrollment?.stopReason ? <div className="mt-1 text-xs text-muted-foreground">{event.enrollment.stopReason}</div> : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Summary</div>
              <div className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                {event.summary || event.errorMessage || "No summary captured for this outreach call."}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Transcript</div>
              <div className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap text-sm text-foreground">
                {transcript || "No transcript was captured for this outreach call."}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Call facts</div>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="font-medium">Provider</dt><dd className="text-muted-foreground">{event.provider}</dd></div>
                <div><dt className="font-medium">Provider call ID</dt><dd className="break-all text-muted-foreground">{event.providerCallId || "Not available"}</dd></div>
                <div><dt className="font-medium">Outcome</dt><dd className="text-muted-foreground">{outcome || "Not available"}</dd></div>
                <div><dt className="font-medium">Call status</dt><dd className="text-muted-foreground">{callStatus || event.status || "Not available"}</dd></div>
                <div><dt className="font-medium">From / To</dt><dd className="text-muted-foreground">{event.fromPhone || "Unknown"} {"->"} {event.toPhone}</dd></div>
                <div><dt className="font-medium">Attempt count</dt><dd className="text-muted-foreground">{event.enrollment?.attemptCount ?? 0}</dd></div>
              </dl>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recording</div>
              <div className="mt-3 text-sm text-muted-foreground">
                {recordingUrl ? (
                  <a className="break-all text-primary underline underline-offset-4" href={recordingUrl} target="_blank" rel="noreferrer">
                    Open recording
                  </a>
                ) : (
                  "No recording URL was captured for this call."
                )}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Lead context</div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                {event.lead?.industry ? <div><span className="font-medium text-foreground">Industry:</span> {event.lead.industry}</div> : null}
                {event.lead?.angle ? <div><span className="font-medium text-foreground">Angle:</span> {event.lead.angle}</div> : null}
                {event.lead?.painPoint ? <div><span className="font-medium text-foreground">Pain point:</span> {event.lead.painPoint}</div> : null}
                {event.lead?.offer ? <div><span className="font-medium text-foreground">Offer:</span> {event.lead.offer}</div> : null}
                {event.lead?.sourceList ? <div><span className="font-medium text-foreground">Source list:</span> {event.lead.sourceList}</div> : null}
                {event.lead?.notes ? <div><span className="font-medium text-foreground">Notes:</span> {event.lead.notes}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
