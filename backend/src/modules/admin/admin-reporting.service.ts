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

async function buildReportSections(prisma: PrismaClient, recipient: AdminReportRecipient) {
  const sections: string[] = [];

  if (recipient.includeSystemDashboard || recipient.includeSystemReadiness || recipient.includeScaleGate) {
    const [dashboard, readiness, scaleGate] = await Promise.all([
      recipient.includeSystemDashboard ? computeOperatorDashboard(prisma) : Promise.resolve(null),
      recipient.includeSystemReadiness ? computeSystemReadiness(prisma) : Promise.resolve(null),
      recipient.includeScaleGate ? computeScaleGate(prisma, { actorUserId: null, promotionAttempted: false }) : Promise.resolve(null)
    ]);

    if (dashboard) {
      sections.push(
        [
          "System Dashboard",
          `Inbound calls: 5m ${dashboard.inboundCalls.last5m}, 1h ${dashboard.inboundCalls.last1h}, 24h ${dashboard.inboundCalls.last24h}`,
          `Webhook success: ${Math.round(dashboard.webhookSuccessRate * 100)}%`,
          `Twilio error rate: ${Math.round(dashboard.twilioErrorRate * 100)}%`,
          `Vapi error rate: ${Math.round(dashboard.vapiProcessingErrorRate * 100)}%`,
          `Missing lead links: ${dashboard.callsMissingLeadLinkage}`,
          `Auto-recovery last 24h: ${dashboard.autoRecoveryVolumeLast24h}`,
          `Org exposure: ${Math.round(dashboard.orgExposurePercent * 100)}%`,
          `Traffic exposure: ${Math.round(dashboard.trafficExposurePercent * 100)}%`
        ].join("\n")
      );
    }

    if (readiness) {
      sections.push(
        [
          "System Readiness",
          `Webhook success: ${Math.round(readiness.webhookSuccessRate * 100)}%`,
          `Lead linkage: ${Math.round(readiness.leadLinkageRate * 100)}%`,
          `Average call quality: ${Math.round(readiness.avgCallQuality)}`,
          `P1 incidents last 30d: ${readiness.P1IncidentCountLast30d}`,
          `SLA WARN: ${readiness.SLAStatusDistribution.WARN}`,
          `SLA CRITICAL: ${readiness.SLAStatusDistribution.CRITICAL}`,
          `Data integrity anomalies: ${readiness.DataIntegrityAnomalies}`
        ].join("\n")
      );
    }

    if (scaleGate) {
      sections.push(
        [
          "Scale Gate",
          `Result: ${scaleGate.result}`,
          `Failing criteria: ${scaleGate.failingCriteria.length ? scaleGate.failingCriteria.join(", ") : "none"}`,
          `Cooldown required: ${scaleGate.cooldown.required ? "yes" : "no"}`,
          `Org exposure threshold: ${Math.round(scaleGate.exposure.thresholds.orgExposureThreshold * 100)}%`,
          `Traffic exposure threshold: ${Math.round(scaleGate.exposure.thresholds.trafficExposureThreshold * 100)}%`
        ].join("\n")
      );
    }
  }

  if (recipient.includeOutreachOverview) {
    const outreach = await fetchOutreachOverview(prisma);
    sections.push(
      [
        "Outreach Overview",
        `Total leads: ${outreach.totalLeads}`,
        `Active enrollments: ${outreach.activeEnrollments}`,
        `Emails sent: ${outreach.emailsSent}`,
        `Replies: ${outreach.replies}`,
        `Suppressions / unsubscribes: ${outreach.unsubscribes}`
      ].join("\n")
    );
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
    sections.push(
      [
        "Billing Diagnostics",
        `Overall: ${diagnostics.summary.overall}`,
        `Checkout ready: ${diagnostics.summary.checkoutReady ? "yes" : "no"}`,
        `Change plan ready: ${diagnostics.summary.changePlanReady ? "yes" : "no"}`,
        `Customer portal ready: ${diagnostics.summary.customerPortalReady ? "yes" : "no"}`,
        `Top issues: ${diagnostics.summary.topIssues.length ? diagnostics.summary.topIssues.join(", ") : "none"}`
      ].join("\n")
    );
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
    ...sections.flatMap((section, index) => [section, index === sections.length - 1 ? null : "\n---\n"]).filter(Boolean) as string[],
    "",
    "This report was sent from the Khan Systems internal admin reporting worker."
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, text };
}

export async function sendAdminReportTest(prisma: PrismaClient, recipientId: string) {
  const recipient = (await listAdminReportRecipients(prisma)).find((item) => item.id === recipientId);
  if (!recipient) throw new Error("Report recipient not found.");
  const { subject, text } = await buildRecipientReport(prisma, recipient, "test");
  await sendOrgOperationalNotificationEmail({
    to: recipient.email,
    title: subject,
    body: text,
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
      const { subject, text } = await buildRecipientReport(prisma, recipient, cadence);
      await sendOrgOperationalNotificationEmail({
        to: recipient.email,
        title: subject,
        body: text,
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
