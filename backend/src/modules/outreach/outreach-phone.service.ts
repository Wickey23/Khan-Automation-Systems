import type { PrismaClient, UserRole } from "@prisma/client";
import { env } from "../../config/env";

function normalizePhoneE164(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const digits = `+${raw.slice(1).replace(/\D/g, "")}`;
    return /^\+\d{10,15}$/.test(digits) ? digits : "";
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return /^\d{10,15}$/.test(digits) ? `+${digits}` : "";
}

function cleanText(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text || "";
}

function buildOutreachPhonePrompt(input: {
  orgName: string;
  companyName: string;
  contactName: string;
  industry: string;
  city: string;
  state: string;
  angle: string;
  painPoint: string;
  offer: string;
  sourceList: string;
  notes: string;
  customPrompt?: string;
}) {
  const base = [
    "You are an AI sales assistant making a short professional outreach call for Khan Automation Systems.",
    `Organization: ${input.orgName}`,
    `Prospect company: ${input.companyName || "Unknown company"}`,
    `Prospect contact: ${input.contactName || "Unknown contact"}`,
    `Industry: ${input.industry || "Local service business"}`,
    `Location: ${[input.city, input.state].filter(Boolean).join(", ") || "Unknown"}`,
    `Conversation angle: ${input.angle || "General missed-call recovery and lead capture"}`,
    `Prospect pain point: ${input.painPoint || "Unknown"}`,
    `Offer to emphasize: ${input.offer || "Short overview, callback, or demo"}`,
    `Source list: ${input.sourceList || "Unknown"}`,
    `Lead notes: ${input.notes || "None"}`,
    "Your goal is to briefly introduce Khan Automation Systems and ask whether the business would be open to learning how AI phone answering and missed-call recovery could help them capture more jobs.",
    "Call style rules:",
    "- Sound professional, calm, concise, and respectful.",
    "- Do not sound like a chatbot or over-explain.",
    "- Ask at most one question at a time.",
    "- Keep the call under 90 seconds unless the prospect actively engages.",
    "- If the person is not interested, thank them politely and end the call cleanly.",
    "- If the person asks for details, explain simply that the system answers calls, captures service requests, recovers missed calls with text, and gives the office a clear action queue.",
    "- If the person shows interest, ask for the best next step: quick callback, demo, or permission to text/email details.",
    "- If they ask to speak to a human, say a team member will follow up directly.",
    "- Never pressure the caller. Never argue. Never pretend there is a booking or dispatch action.",
    "- Never invent pricing, promises, or implementation details you do not know.",
    "- If the line is unclear or you cannot understand them, apologize once, ask for a brief repeat, and if still unclear, say a team member can follow up later.",
    "Safe close examples:",
    "- Thanks for your time. We will not keep you.",
    "- Appreciate it. A team member can follow up with more details.",
    "- Understood. Thanks for taking the call.",
    "Primary objective: determine interest level and leave a professional impression."
  ];
  if (cleanText(input.customPrompt)) {
    base.push("Custom campaign instructions:");
    base.push(cleanText(input.customPrompt));
  }
  return base.join("\n");
}

function buildOutreachVariableValues(input: {
  orgName: string;
  companyName: string;
  contactName: string;
  industry: string;
  city: string;
  state: string;
  angle: string;
  painPoint: string;
  offer: string;
  sourceList: string;
  notes: string;
  phone: string;
}) {
  return {
    orgName: input.orgName || "",
    companyName: input.companyName || "",
    contactName: input.contactName || "",
    industry: input.industry || "",
    city: input.city || "",
    state: input.state || "",
    angle: input.angle || "",
    painPoint: input.painPoint || "",
    offer: input.offer || "",
    sourceList: input.sourceList || "",
    notes: input.notes || "",
    phone: input.phone || "",
    location: [input.city, input.state].filter(Boolean).join(", "),
    prospectSummary: [
      input.companyName || input.contactName || "Prospect",
      input.industry || null,
      input.angle || null,
      input.painPoint || null,
      [input.city, input.state].filter(Boolean).join(", ") || null,
      input.notes || null
    ]
      .filter(Boolean)
      .join(" • ")
  };
}

function sanitizeProspectName(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) return "";
  const normalized = text.toLowerCase();
  if (["unknown", "unknown caller", "there", "n/a", "na"].includes(normalized)) return "";
  return text;
}

function getHourInTimezone(date: Date, timeZone: string) {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone
  }).format(date);
  return Number.parseInt(hour, 10);
}

function isWithinWindow(now: Date, input: { timeZone: string; startHour: number; endHour: number }) {
  const hour = getHourInTimezone(now, input.timeZone);
  return hour >= input.startHour && hour < input.endHour;
}

function nextWindowStart(now: Date, input: { timeZone: string; startHour: number; endHour: number }) {
  const currentHour = getHourInTimezone(now, input.timeZone);
  const next = new Date(now);
  if (currentHour < input.startHour) {
    next.setHours(next.getHours() + (input.startHour - currentHour), 0, 0, 0);
    return next;
  }
  next.setDate(next.getDate() + 1);
  next.setHours(next.getHours() + (24 - currentHour + input.startHour), 0, 0, 0);
  return next;
}

async function resolveCallerConfig(db: any, orgId: string, callerConfigId?: string | null) {
  if (callerConfigId) {
    return db.outreachCallerConfig.findUnique({ where: { id: callerConfigId } });
  }
  return db.outreachCallerConfig.findFirst({
    where: { orgId, isActive: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function startOutreachAiCall(input: {
  prisma: PrismaClient;
  leadId: string;
  actorUserId: string;
  actorRole: UserRole;
  callerConfigId?: string | null;
  enrollmentId?: string | null;
  force?: boolean;
}) {
  const db = input.prisma as any;
  const lead = await db.outreachLead.findUnique({
    where: { id: input.leadId },
    include: {
      organization: { select: { id: true, name: true } }
    }
  });
  if (!lead) {
    throw new Error("Lead not found.");
  }

  const priorStartedCall = await db.outreachPhoneEvent.findFirst({
    where: {
      leadId: lead.id,
      eventType: { in: ["STARTED", "COMPLETED"] }
    },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  if (priorStartedCall && !input.force) {
    throw new Error("This lead has already been called by Caller AI.");
  }

  const customerNumber = normalizePhoneE164(lead.phone || "");
  if (!customerNumber) {
    throw new Error("Lead does not have a valid phone number for AI calling.");
  }
  if (!env.VAPI_API_KEY) {
    throw new Error("VAPI_API_KEY is not configured.");
  }

  const aiConfig = await db.aiAgentConfig.findFirst({
    where: { orgId: lead.orgId },
    select: {
      model: true,
      voice: true,
      temperature: true,
      vapiPhoneNumberId: true
    }
  });
  const appConfig = await db.appConfig.findUnique({
    where: { id: "singleton" },
    select: {
      demoVapiPhoneNumberId: true
    }
  });
  const callerConfig = await resolveCallerConfig(db, lead.orgId, input.callerConfigId || null);

  const phoneNumberId =
    cleanText(callerConfig?.vapiPhoneNumberId) ||
    cleanText(aiConfig?.vapiPhoneNumberId) ||
    cleanText(appConfig?.demoVapiPhoneNumberId);
  if (!phoneNumberId) {
    throw new Error("No Vapi outbound phone number is configured for outreach calling.");
  }
  const assistantId = cleanText(callerConfig?.vapiAssistantId);

  const prospectName = sanitizeProspectName(lead.contactName) || sanitizeProspectName(lead.companyName);
  const variableValues = buildOutreachVariableValues({
    orgName: cleanText(lead.organization?.name) || "Khan Automation Systems",
    companyName: cleanText(lead.companyName),
    contactName: prospectName,
    industry: cleanText(lead.industry),
    city: cleanText(lead.city),
    state: cleanText(lead.state),
    angle: cleanText(lead.angle),
    painPoint: cleanText(lead.painPoint),
    offer: cleanText(lead.offer),
    sourceList: cleanText(lead.sourceList),
    notes: cleanText(lead.notes),
    phone: customerNumber
  });
  const contextualPrompt = buildOutreachPhonePrompt({
    orgName: cleanText(lead.organization?.name) || "Khan Automation Systems",
    companyName: cleanText(lead.companyName),
    contactName: prospectName,
    industry: cleanText(lead.industry),
    city: cleanText(lead.city),
    state: cleanText(lead.state),
    angle: cleanText(lead.angle),
    painPoint: cleanText(lead.painPoint),
    offer: cleanText(lead.offer),
    sourceList: cleanText(lead.sourceList),
    notes: cleanText(lead.notes),
    customPrompt: cleanText(callerConfig?.prompt)
  });

  const assistantPayload = assistantId
    ? {
        assistantId,
        assistantOverrides: {
          variableValues,
          metadata: {
            source: "admin-outreach",
            prospectSummary: variableValues.prospectSummary
          }
        }
      }
    : {
        assistant: {
          name: `Khan Outreach - ${cleanText(lead.companyName) || prospectName || "Prospect"}`,
          model: cleanText(aiConfig?.model) || "gpt-4o-mini",
          voice: cleanText(aiConfig?.voice) || "alloy",
          temperature: typeof aiConfig?.temperature === "number" ? aiConfig.temperature : 0.3,
          systemPrompt: contextualPrompt
        }
      };

  const response = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.VAPI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      phoneNumberId,
      customer: {
        number: customerNumber,
        name: prospectName || undefined
      },
      ...assistantPayload,
      metadata: {
        source: "admin-outreach",
        outreachLeadId: lead.id,
        outreachPhoneEnrollmentId: input.enrollmentId || null,
        outreachCallerConfigId: callerConfig?.id || null,
        orgId: lead.orgId,
        companyName: cleanText(lead.companyName) || null,
        contactName: cleanText(lead.contactName) || null,
        variableValues
      }
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Vapi call request failed (${response.status}): ${text || "Unknown error"}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const callId = String(payload.id || payload.callId || "").trim();
  const status = String(payload.status || "queued").trim() || "queued";

  await Promise.all([
    db.outreachLead.update({
      where: { id: lead.id },
      data: {
        lastContactedAt: new Date(),
        status: lead.status === "NEW" ? "ACTIVE" : undefined
      }
    }),
    input.enrollmentId
      ? db.outreachPhoneEnrollment.update({
          where: { id: input.enrollmentId },
          data: {
            lastCalledAt: new Date(),
            processingStartedAt: null,
            attemptCount: { increment: 1 }
          }
        })
      : Promise.resolve(null),
    db.outreachPhoneEvent.create({
      data: {
        orgId: lead.orgId,
        leadId: lead.id,
        enrollmentId: input.enrollmentId || null,
        callerConfigId: callerConfig?.id || null,
        provider: "VAPI",
        providerCallId: callId || null,
        eventType: "STARTED",
        toPhone: customerNumber,
        fromPhone: cleanText(callerConfig?.twilioFromNumber) || null,
        status,
        metadata: {
          phoneNumberId
        }
      }
    }),
    db.auditLog.create({
      data: {
        orgId: lead.orgId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: "OUTREACH_AI_CALL_STARTED",
        metadataJson: JSON.stringify({
          leadId: lead.id,
          callId: callId || null,
          status,
          toNumber: customerNumber,
          phoneNumberId,
          assistantId: assistantId || null,
          callerConfigId: callerConfig?.id || null,
          enrollmentId: input.enrollmentId || null
        })
      }
    })
  ]);

  return {
    leadId: lead.id,
    callId: callId || null,
    status,
    toNumber: customerNumber,
    phoneNumberId
  };
}

export async function runOutreachPhoneTick(input: {
  prisma: PrismaClient;
  processingTimeoutMs: number;
}) {
  const db = input.prisma as any;
  const now = new Date();
  const due = await db.outreachPhoneEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextCallAt: { lte: now },
      OR: [{ processingStartedAt: null }, { processingStartedAt: { lt: new Date(now.getTime() - input.processingTimeoutMs) } }]
    },
    include: {
      lead: true,
      callerConfig: true
    },
    orderBy: { nextCallAt: "asc" },
    take: 20
  });

  let processed = 0;
  let started = 0;
  let failed = 0;

  for (const enrollment of due) {
    processed += 1;
    const config = enrollment.callerConfig;
    if (!config || !config.isActive) {
      await db.outreachPhoneEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "FAILED", stopReason: "Caller AI configuration is missing or inactive.", processingStartedAt: null }
      });
      failed += 1;
      continue;
    }

    const withinWindow = isWithinWindow(now, {
      timeZone: cleanText(config.timezone) || "America/New_York",
      startHour: Number(config.windowStartHour ?? 9),
      endHour: Number(config.windowEndHour ?? 17)
    });
    if (!withinWindow) {
      await db.outreachPhoneEnrollment.update({
        where: { id: enrollment.id },
        data: {
          nextCallAt: nextWindowStart(now, {
            timeZone: cleanText(config.timezone) || "America/New_York",
            startHour: Number(config.windowStartHour ?? 9),
            endHour: Number(config.windowEndHour ?? 17)
          }),
          processingStartedAt: null
        }
      });
      continue;
    }

    const dailyCount = await db.outreachPhoneEvent.count({
      where: {
        orgId: enrollment.orgId,
        callerConfigId: config.id,
        eventType: "STARTED",
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
      }
    });
    if (dailyCount >= Number(config.maxCallsPerDay ?? 20)) {
      await db.outreachPhoneEnrollment.update({
        where: { id: enrollment.id },
        data: { nextCallAt: nextWindowStart(now, { timeZone: cleanText(config.timezone) || "America/New_York", startHour: Number(config.windowStartHour ?? 9), endHour: Number(config.windowEndHour ?? 17) }), processingStartedAt: null }
      });
      continue;
    }

    await db.outreachPhoneEnrollment.update({
      where: { id: enrollment.id },
      data: { processingStartedAt: now }
    });

    try {
      await startOutreachAiCall({
        prisma: input.prisma,
        leadId: enrollment.leadId,
        actorUserId: "system-outreach-phone",
        actorRole: "SYSTEM" as UserRole,
        callerConfigId: config.id,
        enrollmentId: enrollment.id
      });
      await db.outreachPhoneEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "COMPLETED",
          nextCallAt: null,
          processingStartedAt: null
        }
      });
      started += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown outreach phone failure.";
      await db.outreachPhoneEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "FAILED",
          stopReason: message,
          processingStartedAt: null
        }
      });
      await db.outreachPhoneEvent.create({
        data: {
          orgId: enrollment.orgId,
          leadId: enrollment.leadId,
          enrollmentId: enrollment.id,
          callerConfigId: config.id,
          provider: "VAPI",
          eventType: "FAILED",
          toPhone: cleanText(enrollment.lead?.phone) || "",
          fromPhone: cleanText(config.twilioFromNumber) || null,
          errorMessage: message
        }
      });
      failed += 1;
    }
  }

  return { processed, started, failed };
}
