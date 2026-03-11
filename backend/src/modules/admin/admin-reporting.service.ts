import { randomUUID } from "crypto";
import { UserRole, type PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { z } from "zod";
import { env } from "../../config/env";
import { sendOrgOperationalNotificationEmail } from "../../services/email";
import { computeBillingDiagnostics } from "../billing/billing-diagnostics.service";
import { computeOperatorDashboard, computeScaleGate, computeSystemReadiness } from "./system-ops.service";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

const adminReportRecipientSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  isActive: z.boolean().default(true),
  dailyEnabled: z.boolean().default(true),
  weeklyEnabled: z.boolean().default(false),
  includeSystemDashboard: z.boolean().default(true),
  includeSystemReadiness: z.boolean().default(true),
  includeScaleGate: z.boolean().default(true),
  includeSecuritySummary: z.boolean().default(true),
  includeRevenueSummary: z.boolean().default(true),
  includeOutreachOverview: z.boolean().default(true),
  includeBillingDiagnostics: z.boolean().default(true),
  notes: z.string().nullable().default(null),
  lastDailySentAt: z.string().nullable().default(null),
  lastWeeklySentAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

const adminReportRecipientsSchema = z.array(adminReportRecipientSchema);

export type AdminReportRecipient = z.infer<typeof adminReportRecipientSchema>;

type AdminReportCadence = "daily" | "weekly" | "test";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseRecipientsJson(value: string | null | undefined) {
  let raw: unknown = [];
  try {
    raw = JSON.parse(String(value || "[]"));
  } catch {
    raw = [];
  }
  const parsed = adminReportRecipientsSchema.safeParse(raw);
  if (!parsed.success) return [] as AdminReportRecipient[];
  return parsed.data;
}

async function loadAppConfig(prisma: PrismaClient) {
  return (prisma as any).appConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" }
  });
}

export async function listAdminReportRecipients(prisma: PrismaClient) {
  const config = await loadAppConfig(prisma);
  return parseRecipientsJson(config.adminReportRecipientsJson);
}

async function saveAdminReportRecipients(prisma: PrismaClient, recipients: AdminReportRecipient[], updatedByUserId?: string | null) {
  await (prisma as any).appConfig.upsert({
    where: { id: "singleton" },
    update: {
      adminReportRecipientsJson: JSON.stringify(recipients),
      updatedByUserId: updatedByUserId || null
    },
    create: {
      id: "singleton",
      adminReportRecipientsJson: JSON.stringify(recipients),
      updatedByUserId: updatedByUserId || null
    }
  });
  return recipients;
}

export async function createAdminReportRecipient(
  prisma: PrismaClient,
  input: Omit<AdminReportRecipient, "id" | "createdAt" | "updatedAt" | "lastDailySentAt" | "lastWeeklySentAt">,
  updatedByUserId?: string | null
) {
  const recipients = await listAdminReportRecipients(prisma);
  const email = input.email.trim().toLowerCase();
  if (recipients.some((recipient) => recipient.email === email)) {
    throw new Error("A report recipient with this email already exists.");
  }

  const now = new Date().toISOString();
  const nextRecipient: AdminReportRecipient = {
    id: randomUUID(),
    email,
    isActive: input.isActive ?? true,
    dailyEnabled: input.dailyEnabled ?? true,
    weeklyEnabled: input.weeklyEnabled ?? false,
    includeSystemDashboard: input.includeSystemDashboard ?? true,
    includeSystemReadiness: input.includeSystemReadiness ?? true,
    includeScaleGate: input.includeScaleGate ?? true,
    includeSecuritySummary: input.includeSecuritySummary ?? true,
    includeRevenueSummary: input.includeRevenueSummary ?? true,
    includeOutreachOverview: input.includeOutreachOverview ?? true,
    includeBillingDiagnostics: input.includeBillingDiagnostics ?? true,
    notes: input.notes?.trim() || null,
    lastDailySentAt: null,
    lastWeeklySentAt: null,
    createdAt: now,
    updatedAt: now
  };

  recipients.unshift(nextRecipient);
  await saveAdminReportRecipients(prisma, recipients, updatedByUserId);
  return nextRecipient;
}

export async function updateAdminReportRecipient(
  prisma: PrismaClient,
  recipientId: string,
  patch: Partial<Omit<AdminReportRecipient, "id" | "createdAt" | "updatedAt">>,
  updatedByUserId?: string | null
) {
  const recipients = await listAdminReportRecipients(prisma);
  const index = recipients.findIndex((recipient) => recipient.id === recipientId);
  if (index < 0) throw new Error("Report recipient not found.");

  const current = recipients[index];
  const nextEmail = patch.email ? patch.email.trim().toLowerCase() : current.email;
  if (recipients.some((recipient) => recipient.id !== recipientId && recipient.email === nextEmail)) {
    throw new Error("A report recipient with this email already exists.");
  }

  const next: AdminReportRecipient = {
    ...current,
    ...patch,
    email: nextEmail,
    notes: patch.notes !== undefined ? patch.notes?.trim() || null : current.notes,
    updatedAt: new Date().toISOString()
  };
  recipients[index] = next;
  await saveAdminReportRecipients(prisma, recipients, updatedByUserId);
  return next;
}

export async function deleteAdminReportRecipient(prisma: PrismaClient, recipientId: string, updatedByUserId?: string | null) {
  const recipients = await listAdminReportRecipients(prisma);
  const nextRecipients = recipients.filter((recipient) => recipient.id !== recipientId);
  if (nextRecipients.length === recipients.length) throw new Error("Report recipient not found.");
  await saveAdminReportRecipients(prisma, nextRecipients, updatedByUserId);
  return true;
}

async function fetchOutreachOverview(prisma: PrismaClient) {
  const [totalLeads, activeEnrollments, emailsSent, replies, unsubscribes] = await Promise.all([
    (prisma as any).outreachLead.count(),
    (prisma as any).outreachEnrollment.count({ where: { status: "ACTIVE" } }),
    (prisma as any).outreachEmailEvent.count({ where: { eventType: "SENT" } }),
    (prisma as any).outreachLead.count({ where: { status: "REPLIED" } }),
    (prisma as any).outreachSuppression.count()
  ]);

  return { totalLeads, activeEnrollments, emailsSent, replies, unsubscribes };
}

async function fetchRevenueSummary(prisma: PrismaClient) {
  const subscriptions = await prisma.subscription.findMany({
    select: { id: true, orgId: true, plan: true, status: true, createdAt: true }
  });

  const latestByOrg = new Map<string, { plan: string; status: string }>();
  for (const row of subscriptions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const key = row.orgId || `row:${row.id}`;
    if (latestByOrg.has(key)) continue;
    latestByOrg.set(key, { plan: row.plan, status: String(row.status || "").toLowerCase() });
  }

  const active = Array.from(latestByOrg.values()).filter((row) => ["active", "trialing"].includes(row.status));
  const byPlan = { founding: 0, starter: 0, pro: 0 };
  for (const row of active) {
    if (row.plan === "PRO") byPlan.pro += 1;
    else if (row.plan === "FOUNDING") byPlan.founding += 1;
    else byPlan.starter += 1;
  }

  const recurringPrice = { founding: 249, starter: 349, pro: 599 };
  const estimatedMrrUsd =
    byPlan.founding * recurringPrice.founding + byPlan.starter * recurringPrice.starter + byPlan.pro * recurringPrice.pro;

  let stripePaidLast30d: number | null = null;
  let stripePaidCurrency: string | null = null;
  let stripeError: string | null = null;
  try {
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.includes("placeholder")) {
      const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const invoices = await stripe.invoices.list({
        status: "paid",
        created: { gte: since },
        limit: 100
      });
      const paid = invoices.data.reduce((sum, invoice) => sum + (invoice.amount_paid || 0), 0);
      stripePaidLast30d = Math.round((paid / 100) * 100) / 100;
      stripePaidCurrency = invoices.data[0]?.currency?.toUpperCase() || "USD";
    }
  } catch (error) {
    stripeError = error instanceof Error ? error.message : "stripe_unavailable";
  }

  return {
    estimatedMrrUsd,
    activeSubscriptions: active.length,
    subscriptionsByPlan: byPlan,
    stripePaidLast30d,
    stripePaidCurrency,
    stripeError
  };
}

type ReportSection = {
  title: string;
  rows: Array<{ label: string; value: string }>;
};

async function buildReportSections(prisma: PrismaClient, recipient: AdminReportRecipient) {
  const sections: ReportSection[] = [];

  if (recipient.includeSystemDashboard || recipient.includeSystemReadiness || recipient.includeScaleGate) {
    const [dashboard, readiness, scaleGate] = await Promise.all([
      recipient.includeSystemDashboard ? computeOperatorDashboard(prisma) : Promise.resolve(null),
      recipient.includeSystemReadiness ? computeSystemReadiness(prisma) : Promise.resolve(null),
      recipient.includeScaleGate ? computeScaleGate(prisma, { actorUserId: null, promotionAttempted: false }) : Promise.resolve(null)
    ]);

    if (dashboard) {
      sections.push({
        title: "System Dashboard",
        rows: [
          { label: "Inbound calls", value: `5m ${dashboard.inboundCalls.last5m} / 1h ${dashboard.inboundCalls.last1h} / 24h ${dashboard.inboundCalls.last24h}` },
          { label: "Webhook success", value: `${Math.round(dashboard.webhookSuccessRate * 100)}%` },
          { label: "Twilio error rate", value: `${Math.round(dashboard.twilioErrorRate * 100)}%` },
          { label: "Vapi error rate", value: `${Math.round(dashboard.vapiProcessingErrorRate * 100)}%` },
          { label: "Missing lead links", value: String(dashboard.callsMissingLeadLinkage) },
          { label: "Auto-recovery last 24h", value: String(dashboard.autoRecoveryVolumeLast24h) },
          { label: "Org exposure", value: `${Math.round(dashboard.orgExposurePercent * 100)}%` },
          { label: "Traffic exposure", value: `${Math.round(dashboard.trafficExposurePercent * 100)}%` }
        ]
      });
    }

    if (readiness) {
      sections.push({
        title: "System Readiness",
        rows: [
          { label: "Webhook success", value: `${Math.round(readiness.webhookSuccessRate * 100)}%` },
          { label: "Lead linkage", value: `${Math.round(readiness.leadLinkageRate * 100)}%` },
          { label: "Average call quality", value: String(Math.round(readiness.avgCallQuality)) },
          { label: "P1 incidents last 30d", value: String(readiness.P1IncidentCountLast30d) },
          { label: "SLA WARN", value: String(readiness.SLAStatusDistribution.WARN) },
          { label: "SLA CRITICAL", value: String(readiness.SLAStatusDistribution.CRITICAL) },
          { label: "Data integrity anomalies", value: String(readiness.DataIntegrityAnomalies) }
        ]
      });
    }

    if (scaleGate) {
      sections.push({
        title: "Scale Gate",
        rows: [
          { label: "Result", value: scaleGate.result },
          { label: "Failing criteria", value: scaleGate.failingCriteria.length ? scaleGate.failingCriteria.join(", ") : "none" },
          { label: "Cooldown required", value: scaleGate.cooldown.required ? "yes" : "no" },
          { label: "Org exposure threshold", value: `${Math.round(scaleGate.exposure.thresholds.orgExposureThreshold * 100)}%` },
          { label: "Traffic exposure threshold", value: `${Math.round(scaleGate.exposure.thresholds.trafficExposureThreshold * 100)}%` }
        ]
      });
    }

    if (recipient.includeSecuritySummary && dashboard) {
      sections.push({
        title: "Security and Auth Health",
        rows: [
          { label: "Email provider configured", value: dashboard.emailProviderConfigured ? "yes" : "no" },
          { label: "2FA required last 24h", value: String(dashboard.auth2fa?.required24h ?? 0) },
          { label: "OTP success last 24h", value: String(dashboard.auth2fa?.otpSuccess24h ?? 0) },
          { label: "OTP invalid last 24h", value: String(dashboard.auth2fa?.invalidOtp24h ?? 0) },
          { label: "OTP email failures last 24h", value: String(dashboard.auth2fa?.emailFailure24h ?? 0) },
          { label: "Step-up forbidden last 24h", value: String(dashboard.securityCounters?.stepUpForbidden24h ?? 0) },
          { label: "Webhook replay blocked last 24h", value: String(dashboard.securityCounters?.webhookReplayBlocked24h ?? 0) },
          { label: "Retry-worthy webhook failures", value: String(dashboard.securityCounters?.webhookRetryWorthyFailure24h ?? 0) }
        ]
      });
    }
  }

  if (recipient.includeRevenueSummary) {
    const revenue = await fetchRevenueSummary(prisma);
    sections.push({
      title: "Revenue Summary",
      rows: [
        { label: "Estimated MRR", value: `$${revenue.estimatedMrrUsd.toLocaleString()}` },
        { label: "Active subscriptions", value: String(revenue.activeSubscriptions) },
        {
          label: "Plan mix",
          value: `Founding ${revenue.subscriptionsByPlan.founding}, Starter ${revenue.subscriptionsByPlan.starter}, Pro ${revenue.subscriptionsByPlan.pro}`
        },
        {
          label: "Stripe paid last 30d",
          value:
            revenue.stripePaidLast30d !== null
              ? `${revenue.stripePaidCurrency || "USD"} ${revenue.stripePaidLast30d.toLocaleString()}`
              : revenue.stripeError || "unavailable"
        }
      ]
    });
  }

  if (recipient.includeOutreachOverview) {
    const outreach = await fetchOutreachOverview(prisma);
    sections.push({
      title: "Outreach Overview",
      rows: [
        { label: "Total leads", value: String(outreach.totalLeads) },
        { label: "Active enrollments", value: String(outreach.activeEnrollments) },
        { label: "Emails sent", value: String(outreach.emailsSent) },
        { label: "Replies", value: String(outreach.replies) },
        { label: "Suppressions / unsubscribes", value: String(outreach.unsubscribes) }
      ]
    });
  }

  if (recipient.includeBillingDiagnostics) {
    const diagnostics = await computeBillingDiagnostics({
      prisma,
      stripe,
      auth: {
        userId: "system-admin-reports",
        role: UserRole.SUPER_ADMIN,
        orgId: null
      },
      detailed: false
    });
    sections.push({
      title: "Billing Diagnostics",
      rows: [
        { label: "Overall", value: diagnostics.summary.overall },
        { label: "Checkout ready", value: diagnostics.summary.checkoutReady ? "yes" : "no" },
        { label: "Change plan ready", value: diagnostics.summary.changePlanReady ? "yes" : "no" },
        { label: "Customer portal ready", value: diagnostics.summary.customerPortalReady ? "yes" : "no" },
        { label: "Top issues", value: diagnostics.summary.topIssues.length ? diagnostics.summary.topIssues.join(", ") : "none" }
      ]
    });
  }

  return sections;
}

function cadenceLabel(cadence: AdminReportCadence) {
  if (cadence === "daily") return "Daily";
  if (cadence === "weekly") return "Weekly";
  return "Test";
}

async function buildRecipientReport(prisma: PrismaClient, recipient: AdminReportRecipient, cadence: AdminReportCadence) {
  const sections = await buildReportSections(prisma, recipient);
  const generatedAt = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const subject = `${cadenceLabel(cadence)} Khan Systems diagnostics report`;
  const text = [
    `${cadenceLabel(cadence)} Khan Systems diagnostics report`,
    `Generated: ${generatedAt}`,
    recipient.notes ? `Notes: ${recipient.notes}` : null,
    "",
    ...sections.flatMap((section, index) => [
      section.title,
      ...section.rows.map((row) => `${row.label}: ${row.value}`),
      index === sections.length - 1 ? null : "\n---\n"
    ]).filter(Boolean) as string[],
    "",
    "This report was sent from the Khan Systems internal admin reporting worker."
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="background:#f5f7fb;padding:24px;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:840px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 28px;border-bottom:1px solid #e5e7eb;background:#0f172a;color:#f8fafc;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;">Khan Systems</div>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;">${cadenceLabel(cadence)} diagnostics report</h1>
          <p style="margin:8px 0 0;font-size:14px;opacity:0.85;">Generated ${generatedAt}</p>
        </div>
        <div style="padding:24px 28px;">
          ${recipient.notes ? `<p style="margin:0 0 20px;font-size:14px;color:#475569;"><strong>Notes:</strong> ${escapeHtml(recipient.notes)}</p>` : ""}
          ${sections
            .map(
              (section) => `
                <section style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                  <div style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
                    <h2 style="margin:0;font-size:16px;color:#0f172a;">${escapeHtml(section.title)}</h2>
                  </div>
                  <table style="width:100%;border-collapse:collapse;">
                    <tbody>
                      ${section.rows
                        .map(
                          (row, index) => `
                            <tr>
                              <td style="padding:12px 16px;border-bottom:${index === section.rows.length - 1 ? "none" : "1px solid #e5e7eb"};font-size:13px;color:#475569;width:40%;">${escapeHtml(row.label)}</td>
                              <td style="padding:12px 16px;border-bottom:${index === section.rows.length - 1 ? "none" : "1px solid #e5e7eb"};font-size:13px;color:#0f172a;font-weight:600;">${escapeHtml(row.value)}</td>
                            </tr>
                          `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </section>
              `
            )
            .join("")}
          <p style="margin:20px 0 0;font-size:12px;color:#64748b;">This report was sent from the Khan Systems internal admin reporting worker.</p>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

export async function sendAdminReportTest(prisma: PrismaClient, recipientId: string) {
  const recipient = (await listAdminReportRecipients(prisma)).find((item) => item.id === recipientId);
  if (!recipient) throw new Error("Report recipient not found.");
  const { subject, text, html } = await buildRecipientReport(prisma, recipient, "test");
  await sendOrgOperationalNotificationEmail({
    to: recipient.email,
    title: subject,
    body: text,
    html,
    severity: "INFO"
  });
  return true;
}

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcWeek(date: Date) {
  const current = new Date(startOfUtcDay(date));
  const day = current.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + diff);
  return Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());
}

function shouldSendDaily(recipient: AdminReportRecipient, now: Date) {
  if (!recipient.isActive || !recipient.dailyEnabled) return false;
  if (now.getUTCHours() < Number.parseInt(env.ADMIN_REPORTS_DAILY_HOUR_UTC, 10)) return false;
  if (!recipient.lastDailySentAt) return true;
  const last = new Date(recipient.lastDailySentAt);
  return startOfUtcDay(last) < startOfUtcDay(now);
}

function shouldSendWeekly(recipient: AdminReportRecipient, now: Date) {
  if (!recipient.isActive || !recipient.weeklyEnabled) return false;
  const targetDay = Number.parseInt(env.ADMIN_REPORTS_WEEKLY_DAY_UTC, 10);
  const targetHour = Number.parseInt(env.ADMIN_REPORTS_WEEKLY_HOUR_UTC, 10);
  if (now.getUTCDay() !== targetDay || now.getUTCHours() < targetHour) return false;
  if (!recipient.lastWeeklySentAt) return true;
  const last = new Date(recipient.lastWeeklySentAt);
  return startOfUtcWeek(last) < startOfUtcWeek(now);
}

export async function runAdminReportsTick(prisma: PrismaClient) {
  const recipients = await listAdminReportRecipients(prisma);
  const now = new Date();
  let sent = 0;
  let failed = 0;
  let scanned = recipients.length;
  let updated = false;

  for (const recipient of recipients) {
    const cadence: AdminReportCadence | null = shouldSendDaily(recipient, now)
      ? "daily"
      : shouldSendWeekly(recipient, now)
        ? "weekly"
        : null;

    if (!cadence) continue;

    try {
      const { subject, text, html } = await buildRecipientReport(prisma, recipient, cadence);
      await sendOrgOperationalNotificationEmail({
        to: recipient.email,
        title: subject,
        body: text,
        html,
        severity: "INFO"
      });
      if (cadence === "daily") recipient.lastDailySentAt = now.toISOString();
      if (cadence === "weekly") recipient.lastWeeklySentAt = now.toISOString();
      recipient.updatedAt = now.toISOString();
      sent += 1;
      updated = true;
    } catch {
      failed += 1;
    }
  }

  if (updated) {
    await saveAdminReportRecipients(prisma, recipients, "system-admin-reports");
  }

  return { scanned, sent, failed };
}
