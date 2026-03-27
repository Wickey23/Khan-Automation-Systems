"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/site/toast-provider";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAdminOpsQueueHealth, fetchAdminOpsSmsAudit, retryAdminOpsQueueJob } from "@/lib/api";
import type {
  AdminQueueHealthResponse,
  AdminQueueJobRecord,
  AdminSmsAuditEntry,
  AdminSmsAuditResponse
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { RotateCw } from "lucide-react";

type StatusMeta = {
  label: string;
  classes: string;
};

const STATUS_META: Record<string, StatusMeta> = {
  completed: { label: "Completed", classes: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  processing: { label: "Processing", classes: "border-amber-200 bg-amber-50 text-amber-700" },
  queued: { label: "Queued", classes: "border-slate-200 bg-slate-50 text-slate-700" },
  failed: { label: "Failed", classes: "border-rose-200 bg-rose-50 text-rose-700" },
  unknown: { label: "Unknown", classes: "border-slate-200 bg-slate-50 text-slate-700" }
};

const SMS_EVENT_META: Record<string, StatusMeta> = {
  inbound: { label: "Inbound received", classes: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  outbound_sent: { label: "Outbound sent", classes: "border-sky-200 bg-sky-50 text-sky-700" },
  outbound_attempted: { label: "Outbound attempted", classes: "border-amber-200 bg-amber-50 text-amber-700" },
  failed: { label: "Failed send", classes: "border-rose-200 bg-rose-50 text-rose-700" },
  opt_out: { label: "Opt-out / STOP", classes: "border-rose-200 bg-rose-50 text-rose-700" },
  automation: { label: "Automation pending", classes: "border-purple-200 bg-purple-50 text-purple-700" },
  review: { label: "Requires review", classes: "border-slate-200 bg-slate-50 text-slate-700" },
  unknown: { label: "SMS event", classes: "border-slate-200 bg-slate-50 text-slate-700" }
};

function normalizeStatus(value?: string) {
  if (!value) return "unknown";
  return value.trim().toLowerCase();
}

function humanize(value?: string) {
  if (!value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusMeta(value?: string) {
  const normalized = normalizeStatus(value);
  return STATUS_META[normalized] || STATUS_META.unknown;
}

function getJobTypeLabel(type: string) {
  if (type === "booking-finalizer") return "Booking finalizer";
  if (type === "webhook") return "Webhook processing";
  return type.replace(/[-_]/g, " ");
}

function buildAdminCallHref(callId: string) {
  return `/admin/calls?callId=${encodeURIComponent(callId)}`;
}

function getSmsEventMeta(entry: AdminSmsAuditEntry) {
  const normalized = normalizeStatus(entry.eventType);
  if (normalized.includes("inbound")) return SMS_EVENT_META.inbound;
  if (normalized.includes("outbound") && normalizeStatus(entry.status ?? "").includes("attempt")) {
    return SMS_EVENT_META.outbound_attempted;
  }
  if (normalized.includes("outbound")) return SMS_EVENT_META.outbound_sent;
  if (normalized.includes("opt")) return SMS_EVENT_META.opt_out;
  if (normalized.includes("automation") || normalizeStatus(entry.automation ?? "").includes("pending")) return SMS_EVENT_META.automation;
  if (normalized.includes("review") || normalizeStatus(entry.status ?? "").includes("review")) return SMS_EVENT_META.review;
  if (normalizeStatus(entry.status ?? "").includes("fail") || normalizeStatus(entry.status ?? "").includes("error")) return SMS_EVENT_META.failed;
  return SMS_EVENT_META[normalized] || SMS_EVENT_META.unknown;
}

function formatSmsEventLabel(entry: AdminSmsAuditEntry) {
  const normalized = normalizeStatus(entry.eventType);
  if (normalized.length) {
    return normalized
      .replace(/_/g, " ")
      .split(" ")
      .map((part) => part.at(0)?.toUpperCase() + part.slice(1))
      .join(" ");
  }
  if (entry.status) return entry.status;
  return "SMS event";
}

function summarizeBookingJobs(jobs: AdminQueueJobRecord[]) {
  const bookingJobs = jobs.filter((job) => job.type === "booking-finalizer");
  const failed = bookingJobs.filter((job) => normalizeStatus(job.status).includes("fail"));
  return { bookingJobs, hasFailures: failed.length > 0 };
}

function QueueJobCard({
  job,
  onRetrySuccess
}: {
  job: AdminQueueJobRecord;
  onRetrySuccess?: () => void;
}) {
  const statusMeta = getStatusMeta(job.status);
  const linkedCallLabel = job.callId ? `Call ${job.callId}` : job.providerCallId ? `Provider ${job.providerCallId}` : null;
  const metadataError = job.metadata?.error;
  const { showToast } = useToast();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!job.retryEligible || retrying) return;
    setRetrying(true);
    try {
      const response = await retryAdminOpsQueueJob(job.id);
      showToast({
        title: "Retry queued",
        description: response?.message || "Job has been requeued.",
      });
      onRetrySuccess?.();
    } catch (error) {
      showToast({
        title: "Retry failed",
        description: error instanceof Error ? error.message : "Unable to requeue the job.",
        variant: "error"
      });
    } finally {
      setRetrying(false);
    }
  };

  const retryButtonLabel = job.retryMode === "stuck" ? "Restart job" : "Retry job";
  const metadataRecord = job.metadata && typeof job.metadata === "object" ? (job.metadata as Record<string, unknown>) : null;
  const metadataNavigationAction = metadataRecord?.navigationAction;
  const navigationAction =
    metadataNavigationAction && typeof metadataNavigationAction === "object"
      ? {
        href: (metadataNavigationAction as Record<string, unknown>).href as string,
        label: (metadataNavigationAction as Record<string, unknown>).label as string
      }
      : job.callId
        ? { href: buildAdminCallHref(job.callId), label: `Open call ${job.callId}` }
        : job.providerCallId
          ? { href: buildAdminCallHref(job.providerCallId), label: `View provider ${job.providerCallId}` }
          : null;
  const metadataNextStepHint = metadataRecord?.nextStepHint;
  const nextStepHint =
    typeof metadataNextStepHint === "string"
      ? metadataNextStepHint
      : job.retryReason
        ? job.retryReason
        : bookingJobHint(job);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-none text-slate-600">{getJobTypeLabel(job.type)}</p>
          <p className="text-xs tracking-[0.12em] uppercase text-muted-foreground">{job.queue || "Queue"}</p>
        </div>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]", statusMeta.classes)}>
          {statusMeta.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Created {job.createdAt ? formatDate(job.createdAt) : "unknown time"}</p>
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span>Attempts: {job.attempts ?? 0}</span>
        {job.nextAttemptAt ? <span>Next retry: {formatDate(job.nextAttemptAt)}</span> : null}
        {job.durationMs ? <span>Duration: {Math.round(job.durationMs)} ms</span> : null}
      </div>
        {linkedCallLabel ? (
          job.callId ? (
          <Link className="rounded-sm text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300" href={buildAdminCallHref(job.callId)}>
            {linkedCallLabel}
          </Link>
        ) : (
          <p className="text-xs text-slate-500">{linkedCallLabel}</p>
        )
      ) : null}
      {job.message ? <p className="text-xs text-slate-500">Message: {job.message}</p> : null}
      {typeof metadataError === "string" ? <p className="text-xs text-rose-600">Error: {metadataError}</p> : null}
      <div className="mt-3 border-t border-slate-100 pt-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{nextStepHint}</p>
          {navigationAction ? (
            <Button size="sm" variant="ghost" className="px-2 py-1 text-[11px]" asChild>
              <Link href={navigationAction.href}>{navigationAction.label}</Link>
            </Button>
          ) : null}
        </div>
        {job.retryEligible ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying}>
              {retrying ? "Retrying..." : retryButtonLabel}
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Manual next step required.</p>
        )}
      </div>
    </div>
  );
}

function bookingJobHint(job: AdminQueueJobRecord) {
  const status = normalizeStatus(job.status);
  if (status.includes("fail")) return "Booking automation failed; review the call and retry.";
  if (status.includes("queue")) return "Awaiting processing by the finalizer.";
  if (status.includes("process")) return "Finalizer running; wait for completion.";
  if (status.includes("done")) return "Booking completed successfully.";
  return "Booking finalizer activity.";
}

function BookingFinalizerCard({ jobs, loading }: { jobs: AdminQueueJobRecord[]; loading: boolean }) {
  const { bookingJobs, hasFailures } = summarizeBookingJobs(jobs);
  const sampleJobs = bookingJobs.slice(0, 3);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Booking automation</p>
            <CardTitle>Finalizer watch</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">{bookingJobs.length ? `${bookingJobs.length} recent` : "No recent runs"}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Booking finalizer jobs are derived from call automation. Failures here usually need human review or calendar fixes.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading booking health...</p>
        ) : bookingJobs.length ? (
          <div className="space-y-3">
            {sampleJobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{getJobTypeLabel(job.type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(job.createdAt)} · Attempts {job.attempts ?? 0}
                    </p>
                  </div>
                  <StatusBadge kind="booking" state={job.status} label={humanize(job.status)} size="xs" />
                </div>
                <p className="mt-2 text-xs text-slate-600">{job.message || bookingJobHint(job)}</p>
                {job.callId ? (
                  <Link className="mt-2 inline-flex rounded-sm text-[11px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300" href={buildAdminCallHref(job.callId)}>
                    Open related call
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <StateCard
            variant="empty"
            title="Finalizer silent"
            description="No booking finalizer jobs have been recorded yet for this tenant."
            action={
              <Link href="/app/appointments" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                Open booking triage
              </Link>
            }
          />
        )}
        {hasFailures ? (
          <div className="mt-4">
            <StateCard
              variant="retry"
              title="Booking finalizer attention needed"
              description="Failures mean the call capture couldn't sync into the calendar or follow-up path. Inspect one of the call details or open calendar settings."
              action={
                <div className="flex flex-wrap gap-2">
                  <Link href="/app/appointments" className="rounded-sm text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                    Open booking triage
                  </Link>
                  <Link href="/app/settings#settings-calendar" className="rounded-sm text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                    Open calendar settings
                  </Link>
                </div>
              }
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AdminOpsPage() {
  const [queueData, setQueueData] = useState<AdminQueueHealthResponse | null>(null);
  const [smsData, setSmsData] = useState<AdminSmsAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [queuePayload, smsPayload] = await Promise.all([fetchAdminOpsQueueHealth(), fetchAdminOpsSmsAudit()]);
      setQueueData(queuePayload);
      setSmsData(smsPayload);
    } catch (err) {
      console.error(err);
      setQueueData(null);
      setSmsData(null);
      setError(err instanceof Error ? err.message : "Failed to load operations data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const summaryEmpty = !queueData?.summary?.length;
  const typeSummaryEmpty = !queueData?.typeSummary?.length;
  const stuckEmpty = !queueData?.stuckJobs?.length;
  const retryEmpty = !queueData?.retryingJobs?.length;
  const recentJobsEmpty = !queueData?.recentJobs?.length;
  const smsEmpty = !smsData?.summary?.length;

  const smsSummary = useMemo(() => smsData?.summary || [], [smsData]);

  return (
    <AdminGuard>
      <PageShell className="space-y-4">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Ops reliability"
          title="Operations control plane"
          description="Webhook, queue, and SMS health across tenants. Stuck jobs and failed messages are surfaced for immediate intervention."
          actions={
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              <RotateCw className={cn("mr-2 h-4 w-4 transition-transform", loading ? "animate-spin" : "")} />
              Refresh
            </Button>
          }
        />

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm">
            <p className="font-semibold">Unable to load operations data.</p>
            <p className="text-xs">{error}</p>
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Queue summary</p>
                  <CardTitle>Webhook/job states</CardTitle>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{queueData ? "Latest" : "Loading"}</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading queue metrics...</p>
              ) : summaryEmpty ? (
                <p className="text-sm text-muted-foreground">
                  No audit log entries found. Queue health will appear once webhook events run for this tenant.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  {queueData!.summary.map((row) => (
                    <div key={row.status} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{row.label}</p>
                      <p className="mt-1 text-3xl font-bold">{row.count}</p>
                      <p className="text-xs text-muted-foreground">Jobs</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Queue types</p>
                  <CardTitle>Job buckets</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading job types...</p>
              ) : typeSummaryEmpty ? (
                <p className="text-sm text-muted-foreground">No job type data recorded yet.</p>
              ) : (
                <div className="grid gap-2">
                  {queueData!.typeSummary.map((row) => (
                    <div key={row.type} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="font-medium">{row.type.replace(/-/g, " ")}</span>
                      <span className="text-slate-500">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Stalled work</p>
                  <CardTitle>Stuck jobs</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">Threshold: 5m without completion</p>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Checking stuck jobs...</p>
              ) : stuckEmpty ? (
                <p className="text-sm text-muted-foreground">No stuck jobs. Processing is keeping up.</p>
              ) : (
                <div className="space-y-3">
                  {queueData!.stuckJobs.map((job) => (
                    <QueueJobCard key={job.id} job={job} onRetrySuccess={() => void loadData()} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Retry handling</p>
                  <CardTitle>Retrying / failed</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Analyzing failed jobs…</p>
              ) : retryEmpty ? (
                <p className="text-sm text-muted-foreground">No failed jobs pending retry.</p>
              ) : (
                <div className="space-y-3">
                  {queueData!.retryingJobs.map((job) => (
                    <QueueJobCard key={job.id} job={job} onRetrySuccess={() => void loadData()} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <BookingFinalizerCard jobs={queueData?.recentJobs || []} loading={loading} />

        <Card>
          <CardHeader className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Recent jobs</p>
                <CardTitle>Webhook + booking activity</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Limited to 25 records</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Every job log includes the queue, attempts, and latest audit message so you can triage failing calls.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading recent jobs…</p>
            ) : recentJobsEmpty ? (
              <p className="text-sm text-muted-foreground">No recent jobs recorded for this tenant.</p>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead className="w-[170px]">Time</TableHead>
                    <TableHead className="w-[160px]">Status</TableHead>
                    <TableHead className="w-[210px]">Queue</TableHead>
                    <TableHead className="w-[110px]">Attempts</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueData!.recentJobs.map((job) => {
                    const meta = getStatusMeta(job.status);
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</TableCell>
                        <TableCell>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]", meta.classes)}>
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold text-slate-700">{job.queue || "Queue"}</div>
                          <div className="text-xs text-muted-foreground">{getJobTypeLabel(job.type)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold">{job.attempts ?? 0}</div>
                          {job.nextAttemptAt ? (
                            <div className="text-xs text-muted-foreground">Next: {formatDate(job.nextAttemptAt)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <p className="line-clamp-2 break-words text-xs text-slate-600">{job.message || "No recent log detail."}</p>
                          {job.callId ? (
                            <Link className="text-[11px] font-semibold text-primary underline-offset-4 hover:underline" href={buildAdminCallHref(job.callId)}>
                              View call
                            </Link>
                          ) : job.providerCallId ? (
                            <p className="text-[11px] text-muted-foreground">Provider call {job.providerCallId}</p>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">SMS audit</p>
                <CardTitle>Global SMS lifecycle</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading SMS events...</p>
            ) : smsEmpty ? (
              <p className="text-sm text-muted-foreground">No SMS automation events captured yet.</p>
            ) : (
              <div className="grid gap-2.5">
                <div className="flex flex-wrap gap-2">
                  {smsSummary.map((row) => {
                    const key = `${row.eventType}:${row.status}`;
                    return (
                      <Badge key={key} variant="outline" className="border-slate-200 bg-white text-slate-600">
                        {row.eventType} - {row.status} ({row.count})
                      </Badge>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  {smsData!.recentEvents.map((entry) => {
                    const eventMeta = getSmsEventMeta(entry);
                    return (
                      <div key={entry.id} className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-700">{formatSmsEventLabel(entry)}</p>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]", eventMeta.classes)}>
                            {eventMeta.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>{formatDate(entry.createdAt)}</span>
                          <span>Thread: {entry.threadId || "-"}</span>
                          <span>Message SID: {entry.messageSid || "-"}</span>
                          <span>From: {entry.fromNumber || "Unavailable"}</span>
                          <span>To: {entry.toNumber || "Unavailable"}</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          <p>{entry.bodySnippet || "No message snippet available."}</p>
                          {entry.errorText ? <p className="text-rose-600">Error: {entry.errorText}</p> : null}
                          {entry.automation ? <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Automation: {entry.automation}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageShell>
    </AdminGuard>
  );
}

