"use client";

import type { OutreachPhoneEventDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata && typeof metadata[key] === "string" ? String(metadata[key]).trim() : "";
  return value || "";
}

function formatOptional(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text || "Not available";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date not available" : parsed.toLocaleString();
}

function DetailBlock(input: { label: string; value: string; subtle?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{input.label}</div>
      <div className={`mt-2 text-sm leading-6 ${input.subtle ? "text-slate-600" : "text-slate-950"}`}>{input.value}</div>
    </div>
  );
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
  const leadLabel = event.lead?.companyName || event.lead?.contactName || event.toPhone || "Unknown lead";
  const leadContext = [
    event.lead?.industry ? `Industry: ${event.lead.industry}` : null,
    event.lead?.angle ? `Angle: ${event.lead.angle}` : null,
    event.lead?.painPoint ? `Pain point: ${event.lead.painPoint}` : null,
    event.lead?.offer ? `Offer: ${event.lead.offer}` : null,
    event.lead?.sourceList ? `Source list: ${event.lead.sourceList}` : null,
    event.lead?.notes ? `Notes: ${event.lead.notes}` : null
  ].filter(Boolean).join("\n");
  const isSuccess = event.eventType === "COMPLETED";
  const isFailure = event.eventType === "FAILED";
  const callResultLabel = isSuccess ? "Call succeeded" : isFailure ? "Call failed" : "Call in progress";
  const callResultClasses = isSuccess
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : isFailure
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <Card className="overflow-hidden border-slate-300 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected outreach call</div>
            <CardTitle className="text-[26px] tracking-[-0.03em] text-slate-950">Call detail</CardTitle>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${callResultClasses}`}>
                {callResultLabel}
              </span>
            </div>
            <div className="text-sm text-slate-600">
              {leadLabel}
              {event.providerCallId ? ` · call ${event.providerCallId}` : ""}
              {` · ${formatDate(event.createdAt)}`}
            </div>
          </div>
          {onClose ? (
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <DetailBlock label="Status" value={`${event.eventType}${event.status ? ` · ${event.status}` : ""}`} />
          <DetailBlock label="Lead" value={`${event.lead?.contactName || event.lead?.companyName || "Unknown lead"}\n${formatOptional(event.toPhone)}`} subtle />
          <DetailBlock label="Caller profile" value={`${event.callerConfig?.name || "Unknown caller profile"}${event.callerConfig?.timezone ? `\n${event.callerConfig.timezone}` : ""}`} subtle />
          <DetailBlock label="Enrollment" value={`${event.enrollment?.status || "No enrollment"}${event.enrollment?.stopReason ? `\n${event.enrollment.stopReason}` : ""}`} subtle />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Summary</div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-900">
            {event.summary || event.errorMessage || "No summary captured for this outreach call."}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Transcript</div>
            <div className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-900">
              {transcript || "No transcript was captured for this outreach call."}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Call facts</div>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-slate-900">Provider</dt>
                  <dd className="mt-1 text-slate-600">{formatOptional(event.provider)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">Provider call ID</dt>
                  <dd className="mt-1 break-all text-slate-600">{formatOptional(event.providerCallId)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">Outcome</dt>
                  <dd className="mt-1 text-slate-600">{formatOptional(outcome)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">Call status</dt>
                  <dd className="mt-1 text-slate-600">{formatOptional(callStatus || event.status)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">From / To</dt>
                  <dd className="mt-1 text-slate-600">{formatOptional(event.fromPhone)} {"->"} {formatOptional(event.toPhone)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">Attempt count</dt>
                  <dd className="mt-1 text-slate-600">{event.enrollment?.attemptCount ?? 0}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recording</div>
              <div className="mt-3 text-sm text-slate-600">
                {recordingUrl ? (
                  <a className="break-all text-primary underline underline-offset-4" href={recordingUrl} target="_blank" rel="noreferrer">
                    Open recording
                  </a>
                ) : (
                  "No recording URL was captured for this call."
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Lead context</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {leadContext || "No extra lead context was captured for this call."}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
