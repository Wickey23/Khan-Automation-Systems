import { Prisma, type PrismaClient } from "@prisma/client";
import { buildOutreachFromEmail, OutreachSendError, sendOutreachEmail } from "./outreach-email.service";
import { normalizeEmail, stopEnrollmentsForLead } from "./outreach-stop.service";
import { buildOutreachUnsubscribeUrl } from "./outreach-unsubscribe.service";

const RESEND_MIN_INTERVAL_MS = 600;
const DEFAULT_RETRY_DELAY_MS = 15_000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

export type BulkImportRowResult =
  | { lineNumber: number; status: "created"; leadId: string; email: string; enrollmentId?: string }
  | { lineNumber: number; status: "duplicate"; email: string; reason: string }
  | { lineNumber: number; status: "invalid"; reason: string; raw: string };

export const OUTREACH_TEMPLATE_VARIABLES = [
  "contactName",
  "firstName",
  "companyName",
  "email",
  "phone",
  "city",
  "state",
  "industry",
  "website",
  "notes",
  "orgName"
] as const;

export function htmlToText(input: string) {
  return input.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").trim();
}

export function textToHtml(input: string) {
  return input
    .split(/\r?\n\r?\n/)
    .map((paragraph) => `<p>${paragraph.replace(/\r?\n/g, "<br />")}</p>`)
    .join("");
}

export function withUnsubscribeFooter(input: { html?: string | null; text?: string | null; unsubscribeUrl: string }) {
  const footerText = `If you'd rather not hear from me again, click here to unsubscribe: ${input.unsubscribeUrl}`;
  const footerHtml = `<p style="margin-top:24px;font-size:12px;color:#666;">If you'd rather not hear from me again, <a href="${input.unsubscribeUrl}">click here to unsubscribe</a>.</p>`;
  const htmlBase = String(input.html || "").trim();
  const textBase = String(input.text || "").trim();

  return {
    html: [htmlBase || textToHtml(textBase), footerHtml].filter(Boolean).join(""),
    text: [textBase || htmlToText(htmlBase), footerText].filter(Boolean).join("\n\n")
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstNameFromContactName(contactName: string) {
  return contactName.trim().split(/\s+/).filter(Boolean)[0] || "";
}

function buildTemplateContext(input: {
  lead: {
    contactName?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    industry?: string | null;
    website?: string | null;
    notes?: string | null;
  };
  orgName?: string | null;
}) {
  const contactName = String(input.lead.contactName || "").trim();
  return {
    contactName,
    firstName: firstNameFromContactName(contactName),
    companyName: String(input.lead.companyName || "").trim(),
    email: normalizeEmail(input.lead.email || ""),
    phone: String(input.lead.phone || "").trim(),
    city: String(input.lead.city || "").trim(),
    state: String(input.lead.state || "").trim(),
    industry: String(input.lead.industry || "").trim(),
    website: String(input.lead.website || "").trim(),
    notes: String(input.lead.notes || "").trim(),
    orgName: String(input.orgName || "").trim()
  };
}

function renderTemplateString(template: string | null | undefined, context: Record<string, string>, mode: "text" | "html") {
  const source = String(template || "");
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawKey: string) => {
    const key = rawKey in context ? rawKey : "";
    if (!key) return "";
    const value = context[key] || "";
    return mode === "html" ? escapeHtml(value) : value;
  });
}

function renderSequenceStep(input: {
  step: {
    subject: string;
    bodyHtml?: string | null;
    bodyText?: string | null;
  };
  lead: {
    contactName?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    industry?: string | null;
    website?: string | null;
    notes?: string | null;
  };
  orgName?: string | null;
}) {
  const context = buildTemplateContext({
    lead: input.lead,
    orgName: input.orgName
  });
  const renderedSubject = renderTemplateString(input.step.subject, context, "text").trim();
  const renderedText = renderTemplateString(input.step.bodyText, context, "text").trim();
  const renderedHtml = renderTemplateString(input.step.bodyHtml, context, "html").trim();

  return {
    subject: renderedSubject,
    bodyText: renderedText,
    bodyHtml: renderedHtml,
    context
  };
}

export async function assertOutreachOrgExists(prisma: PrismaClient, orgId: string) {
  const org = await (prisma as any).organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true }
  });
  if (!org) throw new Error("Organization not found.");
  return org;
}

export async function resolveOutreachOrgContext(prisma: PrismaClient, orgId?: string | null) {
  if (orgId) {
    return assertOutreachOrgExists(prisma, orgId);
  }

  const preferredOrg = await (prisma as any).organization.findFirst({
    where: {
      name: { contains: "khan", mode: "insensitive" }
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true }
  });
  if (preferredOrg) return preferredOrg;

  const fallbackOrg = await (prisma as any).organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true }
  });
  if (!fallbackOrg) throw new Error("No organization available for outreach.");
  return fallbackOrg;
}

export async function buildBulkImportPreview(input: {
  prisma: PrismaClient;
  orgId: string;
  sequenceId?: string;
  callerConfigId?: string;
  mode?: "EMAIL" | "PHONE";
  text: string;
  dryRun?: boolean;
}) {
  const db = input.prisma as any;
  const outreachMode = input.mode === "PHONE" ? "PHONE" : "EMAIL";
  const results: BulkImportRowResult[] = [];
  const parsed = parseCsvRows(input.text);
  if (parsed.error) {
    return [{ lineNumber: 1, status: "invalid", reason: parsed.error, raw: input.text.slice(0, 120) }];
  }
  const rows = parsed.rows;

  if (!rows.length) {
    return [{ lineNumber: 1, status: "invalid", reason: "CSV must include a header row and at least one data row.", raw: input.text.slice(0, 120) }];
  }

  const seenEmails = new Set<string>();
  for (const row of rows) {
    const email = normalizeEmail(row.values.email || "");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ lineNumber: row.lineNumber, status: "invalid", reason: "Valid email required.", raw: row.raw });
      continue;
    }
    if (seenEmails.has(email)) {
      results.push({ lineNumber: row.lineNumber, status: "duplicate", email, reason: "Email is duplicated within this CSV import." });
      continue;
    }
    seenEmails.add(email);
    const website = String(row.values.website || "").trim();
    if (website) {
      try {
        const normalizedWebsite = website.startsWith("http://") || website.startsWith("https://") ? website : `https://${website}`;
        new URL(normalizedWebsite);
      } catch {
        results.push({ lineNumber: row.lineNumber, status: "invalid", reason: "Website must be a valid URL or domain.", raw: row.raw });
        continue;
      }
    }
    const syntheticReason = detectSyntheticLeadRow(row.values);
    if (syntheticReason) {
      results.push({ lineNumber: row.lineNumber, status: "invalid", reason: syntheticReason, raw: row.raw });
      continue;
    }

    const existing = await db.outreachLead.findFirst({
      where: {
        orgId: input.orgId,
        email
      },
      select: { id: true }
    });
    if (existing) {
      results.push({ lineNumber: row.lineNumber, status: "duplicate", email, reason: "Lead already exists for this org." });
      continue;
    }

    const data = {
      companyName: row.values.companyName || undefined,
      contactName: row.values.contactName || undefined,
      phone: row.values.phone || undefined,
      city: row.values.city || undefined,
      state: row.values.state || undefined,
      industry: row.values.industry || undefined,
      website: row.values.website || undefined,
      notes: row.values.notes || undefined
    };

    if (input.dryRun) {
      results.push({ lineNumber: row.lineNumber, status: "created", leadId: `preview-${row.lineNumber}`, email });
      continue;
    }

    const created = await db.outreachLead.create({
      data: {
        orgId: input.orgId,
        email,
        status: input.sequenceId || input.callerConfigId ? "ACTIVE" : "NEW",
        ...data
      },
      select: { id: true, email: true }
    });
    let enrollmentId: string | undefined;
    if (outreachMode === "EMAIL" && input.sequenceId) {
      const enrollment = await db.outreachEnrollment.create({
        data: {
          orgId: input.orgId,
          leadId: created.id,
          sequenceId: input.sequenceId,
          status: "ACTIVE",
          currentStepNumber: 1,
          nextSendAt: new Date()
        },
        select: { id: true }
      });
      enrollmentId = enrollment.id;
    } else if (outreachMode === "PHONE" && input.callerConfigId) {
      const enrollment = await db.outreachPhoneEnrollment.create({
        data: {
          orgId: input.orgId,
          leadId: created.id,
          callerConfigId: input.callerConfigId,
          status: "ACTIVE",
          nextCallAt: new Date()
        },
        select: { id: true }
      });
      enrollmentId = enrollment.id;
    }
    results.push({ lineNumber: row.lineNumber, status: "created", leadId: created.id, email: created.email, enrollmentId });
  }

  return results;
}

function normalizeHeader(header: string) {
  const value = header.trim().toLowerCase();
  if (["company", "companyname", "business"].includes(value)) return "companyName";
  if (["contact", "contactname", "name"].includes(value)) return "contactName";
  if (["email", "emailaddress"].includes(value)) return "email";
  if (["phone", "phonenumber", "mobile"].includes(value)) return "phone";
  if (value === "city") return "city";
  if (["state", "province", "region"].includes(value)) return "state";
  if (["industry", "category"].includes(value)) return "industry";
  if (["website", "url", "domain"].includes(value)) return "website";
  if (["notes", "note"].includes(value)) return "notes";
  return null;
}

function parseCsvDocument(text: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentCell.trim());
      currentCell = "";
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (inQuotes) {
    return { rows: [], error: "CSV contains an unclosed quoted field." };
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return { rows, error: null as string | null };
}

function extractNumericSuffix(value: string) {
  const match = value.trim().match(/(\d+)$/);
  return match ? match[1] : "";
}

function extractDomainLabel(value: string) {
  if (!value) return "";
  try {
    const normalized = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
    const hostname = new URL(normalized).hostname.replace(/^www\./, "");
    return hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function detectSyntheticLeadRow(values: Record<string, string>) {
  const notes = String(values.notes || "").trim().toLowerCase();
  if (notes === "bulk outreach lead") {
    return "Row looks like generated test data, not a real lead.";
  }

  const companySuffix = extractNumericSuffix(String(values.companyName || ""));
  const emailDomainSuffix = extractNumericSuffix(
    normalizeEmail(values.email || "").split("@")[1]?.split(".")[0] || ""
  );
  const websiteSuffix = extractNumericSuffix(extractDomainLabel(String(values.website || "")));

  if (
    companySuffix &&
    companySuffix === emailDomainSuffix &&
    companySuffix === websiteSuffix
  ) {
    return "Row looks like generated test data, not a real lead.";
  }

  return "";
}

function parseCsvRows(text: string) {
  const parsed = parseCsvDocument(text);
  if (parsed.error) {
    return { rows: [], error: parsed.error };
  }
  if (parsed.rows.length < 2) {
    return { rows: [] as Array<{ lineNumber: number; raw: string; values: Record<string, string> }>, error: null };
  }

  const rawHeaders = parsed.rows[0];
  const headers = rawHeaders.map(normalizeHeader);
  if (!headers.includes("email")) {
    return { rows: [], error: "CSV must include an email column in the header row." };
  }

  const rows = parsed.rows.slice(1).map((cells, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      if (!header) return;
      values[header] = String(cells[headerIndex] || "").trim();
    });
    return {
      lineNumber: index + 2,
      raw: cells.join(","),
      values
    };
  });

  return { rows, error: null as string | null };
}

export async function pauseEnrollment(prisma: PrismaClient, enrollmentId: string) {
  return (prisma as any).outreachEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "PAUSED",
      processingStartedAt: null
    }
  });
}

export async function resumeEnrollment(prisma: PrismaClient, enrollmentId: string) {
  return (prisma as any).outreachEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "ACTIVE",
      nextSendAt: new Date(),
      processingStartedAt: null
    }
  });
}

async function claimEnrollment(input: { prisma: PrismaClient; enrollmentId: string; staleBefore: Date }) {
  const claimed = await (input.prisma as any).outreachEnrollment.updateMany({
    where: {
      id: input.enrollmentId,
      status: "ACTIVE",
      OR: [{ processingStartedAt: null }, { processingStartedAt: { lt: input.staleBefore } }]
    },
    data: {
      processingStartedAt: new Date()
    }
  });
  return claimed.count === 1;
}

async function finalizeAfterSend(input: {
  prisma: PrismaClient;
  enrollmentId: string;
  currentStepNumber: number;
  nextStepNumber: number | null;
  nextSendAt: Date | null;
}) {
  return (input.prisma as any).outreachEnrollment.update({
    where: { id: input.enrollmentId },
    data: {
      currentStepNumber: input.nextStepNumber ?? input.currentStepNumber,
      nextSendAt: input.nextSendAt,
      status: input.nextStepNumber ? "ACTIVE" : "COMPLETED",
      lastSentAt: new Date(),
      processingStartedAt: null
    }
  });
}

async function failEnrollment(input: { prisma: PrismaClient; enrollmentId: string; errorMessage: string; eventId?: string }) {
  if (input.eventId) {
    await (input.prisma as any).outreachEmailEvent.update({
      where: { id: input.eventId },
      data: {
        eventType: "FAILED",
        errorMessage: input.errorMessage
      }
    });
  }

  await (input.prisma as any).outreachEnrollment.update({
    where: { id: input.enrollmentId },
    data: {
      status: "FAILED",
      stopReason: input.errorMessage,
      processingStartedAt: null
    }
  });
}

async function retryEnrollment(input: {
  prisma: PrismaClient;
  enrollmentId: string;
  errorMessage: string;
  retryAt: Date;
  eventId?: string;
}) {
  if (input.eventId) {
    await (input.prisma as any).outreachEmailEvent.update({
      where: { id: input.eventId },
      data: {
        eventType: "FAILED",
        errorMessage: input.errorMessage,
        metadata: {
          retryScheduledAt: input.retryAt.toISOString()
        }
      }
    });
  }

  await (input.prisma as any).outreachEnrollment.update({
    where: { id: input.enrollmentId },
    data: {
      status: "ACTIVE",
      stopReason: null,
      nextSendAt: input.retryAt,
      processingStartedAt: null
    }
  });
}

function computeRetryDelayMs(error: OutreachSendError) {
  if (error.retryAfterSeconds && error.retryAfterSeconds > 0) {
    return Math.min(error.retryAfterSeconds * 1000, MAX_RETRY_DELAY_MS);
  }
  return DEFAULT_RETRY_DELAY_MS;
}

function hardFailureShouldSuppress(message: string) {
  const normalized = message.toLowerCase();
  return [
    "invalid",
    "bounce",
    "bounced",
    "recipient",
    "mailbox",
    "does not exist",
    "unknown user",
    "address rejected"
  ].some((fragment) => normalized.includes(fragment));
}

async function suppressBouncedLead(input: {
  prisma: PrismaClient;
  orgId: string;
  leadId: string;
  email: string;
  reason: string;
}) {
  const db = input.prisma as any;
  await db.outreachSuppression.upsert({
    where: {
      orgId_email: {
        orgId: input.orgId,
        email: input.email
      }
    },
    update: {
      reason: input.reason,
      source: "PROVIDER_BOUNCE"
    },
    create: {
      orgId: input.orgId,
      email: input.email,
      reason: input.reason,
      source: "PROVIDER_BOUNCE"
    }
  });
  await db.outreachLead.update({
    where: { id: input.leadId },
    data: { status: "BOUNCED" }
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampJitterMinutes(value: number) {
  return Math.max(0, Math.min(value, 120));
}

function randomJitterMs(jitterMinutes: number) {
  const minutes = clampJitterMinutes(jitterMinutes);
  if (minutes <= 0) return 0;
  return Math.floor(Math.random() * minutes * 60 * 1000);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function normalizeSendWindow(startHour: number, endHour: number) {
  const safeStart = Math.max(0, Math.min(startHour, 23));
  const safeEnd = Math.max(safeStart + 1, Math.min(endHour, 24));
  return { startHour: safeStart, endHour: safeEnd };
}

function isWithinSendWindow(now: Date, startHour: number, endHour: number) {
  const { startHour: safeStart, endHour: safeEnd } = normalizeSendWindow(startHour, endHour);
  const hour = now.getHours();
  return hour >= safeStart && hour < safeEnd;
}

function computeNextWindowStart(now: Date, startHour: number, endHour: number, jitterMinutes: number) {
  const { startHour: safeStart, endHour: safeEnd } = normalizeSendWindow(startHour, endHour);
  const next = new Date(now);
  if (now.getHours() >= safeEnd) {
    next.setDate(next.getDate() + 1);
  }
  next.setHours(safeStart, 0, 0, 0);
  next.setTime(next.getTime() + randomJitterMs(jitterMinutes));
  return next;
}

async function countSentToday(prisma: PrismaClient, now: Date) {
  return (prisma as any).outreachEmailEvent.count({
    where: {
      eventType: "SENT",
      createdAt: {
        gte: startOfDay(now),
        lte: endOfDay(now)
      }
    }
  });
}

function nextStepSendAt(baseTime: Date, delayHours: number, jitterMinutes: number) {
  return new Date(baseTime.getTime() + delayHours * 60 * 60 * 1000 + randomJitterMs(jitterMinutes));
}

export async function sendEnrollmentStepNow(input: {
  prisma: PrismaClient;
  enrollmentId: string;
  processingTimeoutMs: number;
  sendJitterMinutes?: number;
}) {
  const db = input.prisma as any;
  const staleBefore = new Date(Date.now() - input.processingTimeoutMs);
  const claimed = await claimEnrollment({
    prisma: input.prisma,
    enrollmentId: input.enrollmentId,
    staleBefore
  });
  if (!claimed) return { ok: false as const, reason: "Enrollment is already being processed or is not active." };

  const enrollment = await db.outreachEnrollment.findUnique({
    where: { id: input.enrollmentId },
    include: {
      lead: true,
      sequence: {
        include: {
          organization: {
            select: { name: true }
          },
          steps: {
            orderBy: { stepNumber: "asc" }
          }
        }
      }
    }
  });
  if (!enrollment) return { ok: false as const, reason: "Enrollment not found." };

  const leadEmail = normalizeEmail(enrollment.lead.email);
  const suppression = await db.outreachSuppression.findUnique({
    where: {
      orgId_email: {
        orgId: enrollment.orgId,
        email: leadEmail
      }
    }
  });
  if (suppression || ["UNSUBSCRIBED", "REPLIED", "BOUNCED", "COMPLETED", "PAUSED"].includes(enrollment.lead.status)) {
    await stopEnrollmentsForLead({
      prisma: input.prisma,
      orgId: enrollment.orgId,
      leadId: enrollment.leadId,
      reason: suppression ? "SUPPRESSED" : enrollment.lead.status
    });
    return { ok: false as const, reason: "Lead is not eligible for outreach." };
  }

  const step = enrollment.sequence.steps.find((item: any) => item.stepNumber === enrollment.currentStepNumber);
  if (!step) {
    await db.outreachEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "FAILED",
        stopReason: "Missing sequence step.",
        processingStartedAt: null
      }
    });
    return { ok: false as const, reason: "Missing current step." };
  }

  const unsubscribeUrl = buildOutreachUnsubscribeUrl({
    orgId: enrollment.orgId,
    leadId: enrollment.leadId,
    email: leadEmail
  });
  const renderedStep = renderSequenceStep({
    step,
    lead: enrollment.lead,
    orgName: enrollment.sequence.organization?.name
  });
  const bodies = withUnsubscribeFooter({
    html: renderedStep.bodyHtml,
    text: renderedStep.bodyText,
    unsubscribeUrl
  });

  const event = await db.outreachEmailEvent.create({
    data: {
      orgId: enrollment.orgId,
      leadId: enrollment.leadId,
      enrollmentId: enrollment.id,
      sequenceId: enrollment.sequenceId,
      stepNumber: step.stepNumber,
      provider: "resend",
      eventType: "QUEUED",
      subject: renderedStep.subject,
      toEmail: leadEmail,
      fromEmail: buildOutreachFromEmail(),
      metadata: {
        sequenceName: enrollment.sequence.name,
        templateContext: renderedStep.context,
        renderedBodyHtml: bodies.html,
        renderedBodyText: bodies.text
      }
    }
  });

  try {
    const sent = await sendOutreachEmail({
      to: leadEmail,
      subject: renderedStep.subject,
      html: bodies.html,
      text: bodies.text
    });

    await db.outreachEmailEvent.update({
      where: { id: event.id },
      data: {
        eventType: "SENT",
        providerMessageId: sent.providerMessageId,
        metadata: sent.raw || Prisma.JsonNull
      }
    });

    await db.outreachLead.update({
      where: { id: enrollment.leadId },
      data: {
        status: "ACTIVE",
        lastContactedAt: new Date()
      }
    });

    const nextStep = enrollment.sequence.steps.find((item: any) => item.stepNumber === step.stepNumber + 1) || null;
    await finalizeAfterSend({
      prisma: input.prisma,
      enrollmentId: enrollment.id,
      currentStepNumber: step.stepNumber,
      nextStepNumber: nextStep?.stepNumber || null,
      nextSendAt: nextStep ? nextStepSendAt(new Date(), nextStep.delayHours, input.sendJitterMinutes || 20) : null
    });

    if (!nextStep) {
      await db.outreachLead.update({
        where: { id: enrollment.leadId },
        data: { status: "COMPLETED" }
      });
    }

    return { ok: true as const, eventId: event.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown outreach send failure.";
    if (error instanceof OutreachSendError && error.isRetryable) {
      const retryAt = new Date(Date.now() + computeRetryDelayMs(error) + randomJitterMs(input.sendJitterMinutes || 20));
      await retryEnrollment({
        prisma: input.prisma,
        enrollmentId: enrollment.id,
        errorMessage: message,
        retryAt,
        eventId: event.id
      });
      return { ok: false as const, reason: message };
    }
    if (hardFailureShouldSuppress(message)) {
      await suppressBouncedLead({
        prisma: input.prisma,
        orgId: enrollment.orgId,
        leadId: enrollment.leadId,
        email: leadEmail,
        reason: message
      });
    }
    await failEnrollment({
      prisma: input.prisma,
      enrollmentId: enrollment.id,
      errorMessage: message,
      eventId: event.id
    });
    return { ok: false as const, reason: message };
  }
}

export async function runOutreachTick(input: {
  prisma: PrismaClient;
  processingTimeoutMs: number;
  take?: number;
  dailySendCap?: number;
  sendWindowStartHour?: number;
  sendWindowEndHour?: number;
  sendJitterMinutes?: number;
}) {
  const now = new Date();
  const dailySendCap = Math.max(1, input.dailySendCap || 40);
  const sendWindowStartHour = input.sendWindowStartHour ?? 9;
  const sendWindowEndHour = input.sendWindowEndHour ?? 17;
  const sendJitterMinutes = clampJitterMinutes(input.sendJitterMinutes || 20);

  const due = await (input.prisma as any).outreachEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextSendAt: { lte: now }
    },
    orderBy: { nextSendAt: "asc" },
    take: Math.max(1, Math.min(input.take || 20, 100))
  });

  if (!isWithinSendWindow(now, sendWindowStartHour, sendWindowEndHour)) {
    const deferredUntil = computeNextWindowStart(now, sendWindowStartHour, sendWindowEndHour, sendJitterMinutes);
    if (due.length) {
      await (input.prisma as any).outreachEnrollment.updateMany({
        where: {
          id: { in: due.map((item: { id: string }) => item.id) }
        },
        data: {
          nextSendAt: deferredUntil,
          processingStartedAt: null
        }
      });
    }
    return { processed: 0, sent: 0, failed: 0 };
  }

  const sentToday = await countSentToday(input.prisma, now);
  const remainingDailyCapacity = Math.max(0, dailySendCap - sentToday);
  if (remainingDailyCapacity <= 0) {
    const deferredUntil = computeNextWindowStart(new Date(now.getTime() + 24 * 60 * 60 * 1000), sendWindowStartHour, sendWindowEndHour, sendJitterMinutes);
    if (due.length) {
      await (input.prisma as any).outreachEnrollment.updateMany({
        where: {
          id: { in: due.map((item: { id: string }) => item.id) }
        },
        data: {
          nextSendAt: deferredUntil,
          processingStartedAt: null
        }
      });
    }
    return { processed: 0, sent: 0, failed: 0 };
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;
  for (const [index, enrollment] of due.slice(0, remainingDailyCapacity).entries()) {
    if (index > 0) {
      await sleep(RESEND_MIN_INTERVAL_MS);
    }
    processed += 1;
    const result = await sendEnrollmentStepNow({
      prisma: input.prisma,
      enrollmentId: enrollment.id,
      processingTimeoutMs: input.processingTimeoutMs,
      sendJitterMinutes
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return { processed, sent, failed };
}
