import { Prisma, type PrismaClient } from "@prisma/client";
import { buildOutreachFromEmail, sendOutreachEmail } from "./outreach-email.service";
import { normalizeEmail, stopEnrollmentsForLead } from "./outreach-stop.service";
import { buildOutreachUnsubscribeUrl } from "./outreach-unsubscribe.service";

export type BulkImportRowResult =
  | { lineNumber: number; status: "created"; leadId: string; email: string }
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

export async function buildBulkImportPreview(input: {
  prisma: PrismaClient;
  orgId: string;
  text: string;
}) {
  const db = input.prisma as any;
  const lines = input.text.split(/\r?\n/);
  const results: BulkImportRowResult[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;
    const parts = raw.split("|").map((value) => value.trim());
    const email = normalizeEmail(parts.length === 1 ? parts[0] : parts[2] || "");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ lineNumber: index + 1, status: "invalid", reason: "Valid email required.", raw });
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
      results.push({ lineNumber: index + 1, status: "duplicate", email, reason: "Lead already exists for this org." });
      continue;
    }

    const data =
      parts.length === 1
        ? {}
        : {
            companyName: parts[0] || undefined,
            contactName: parts[1] || undefined,
            phone: parts[3] || undefined,
            city: parts[4] || undefined,
            state: parts[5] || undefined,
            industry: parts[6] || undefined,
            website: parts[7] || undefined,
            notes: parts[8] || undefined
          };

    const created = await db.outreachLead.create({
      data: {
        orgId: input.orgId,
        email,
        status: "NEW",
        ...data
      },
      select: { id: true, email: true }
    });
    results.push({ lineNumber: index + 1, status: "created", leadId: created.id, email: created.email });
  }

  return results;
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

export async function sendEnrollmentStepNow(input: { prisma: PrismaClient; enrollmentId: string; processingTimeoutMs: number }) {
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
      nextSendAt: nextStep ? new Date(Date.now() + nextStep.delayHours * 60 * 60 * 1000) : null
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
    await failEnrollment({
      prisma: input.prisma,
      enrollmentId: enrollment.id,
      errorMessage: message,
      eventId: event.id
    });
    return { ok: false as const, reason: message };
  }
}

export async function runOutreachTick(input: { prisma: PrismaClient; processingTimeoutMs: number; take?: number }) {
  const due = await (input.prisma as any).outreachEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextSendAt: { lte: new Date() }
    },
    orderBy: { nextSendAt: "asc" },
    take: Math.max(1, Math.min(input.take || 20, 100))
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;
  for (const enrollment of due) {
    processed += 1;
    const result = await sendEnrollmentStepNow({
      prisma: input.prisma,
      enrollmentId: enrollment.id,
      processingTimeoutMs: input.processingTimeoutMs
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return { processed, sent, failed };
}
