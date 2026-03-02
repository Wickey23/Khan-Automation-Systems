import { Router } from "express";
import { twiml as Twiml } from "twilio";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { verifyTwilioRequest } from "../../middleware/webhook-security";
import { hasProMessaging } from "../billing/plan-features";

export const smsRouter = Router();

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return input.trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (input.trim().startsWith("+")) return input.trim();
  return `+${digits}`;
}

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function classifySmsKeyword(input: string) {
  const normalized = input.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(normalized)) return "STOP";
  if (["START", "UNSTOP", "YES"].includes(normalized)) return "START";
  if (["HELP", "INFO"].includes(normalized)) return "HELP";
  return null;
}

function mapTwilioMessageStatus(input: string) {
  const normalized = input.trim().toLowerCase();
  if (normalized === "delivered") return "DELIVERED" as const;
  if (normalized === "sent") return "SENT" as const;
  if (["failed", "undelivered", "canceled"].includes(normalized)) return "FAILED" as const;
  if (["queued", "accepted", "sending", "scheduled"].includes(normalized)) return "QUEUED" as const;
  return "QUEUED" as const;
}

function phoneVariants(input: string) {
  const normalized = normalizePhone(input);
  const digits = normalized.replace(/\D/g, "");
  const variants = new Set<string>([normalized, input.trim()]);
  if (digits.length === 11 && digits.startsWith("1")) variants.add(digits.slice(1));
  variants.add(digits);
  return [...variants].filter(Boolean);
}

function extractAssistantReply(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  const direct = [root.output, root.message, root.text, root.reply];
  for (const value of direct) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const messages = Array.isArray(root.messages) ? root.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const role = String(record.role || "").toLowerCase();
    if (role !== "assistant") continue;
    const content = record.content;
    if (typeof content === "string" && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const joined = content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object") {
            const text = (part as Record<string, unknown>).text;
            return typeof text === "string" ? text : "";
          }
          return "";
        })
        .join(" ")
        .trim();
      if (joined) return joined;
    }
  }
  return "";
}

function parsePoliciesJson(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function buildFirstInboundIntro(input: {
  businessName: string;
  policiesJson?: string | null;
  smsConsentText?: string | null;
}) {
  const policies = parsePoliciesJson(input.policiesJson);
  const customWelcomeRaw = String(policies.smsWelcomeMessage || "").trim();
  const marketingEnabled = Boolean(policies.smsMarketingEnabled);
  const marketingBlurb = String(policies.smsMarketingBlurb || "").trim();
  const consent = String(input.smsConsentText || "").trim();

  const welcome =
    customWelcomeRaw.replace(/\{\{\s*businessName\s*\}\}/g, input.businessName) ||
    `Thanks for texting ${input.businessName}. You reached our service team.`;

  const lines = [welcome];
  if (marketingEnabled && marketingBlurb) lines.push(marketingBlurb);
  if (consent) lines.push(consent);
  lines.push("Reply STOP to opt out. Reply START to re-subscribe.");
  return lines.filter(Boolean).join(" ");
}

async function getVapiSmsReply(input: {
  assistantId: string;
  orgId: string;
  orgName: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  threadHistory: Array<{ direction: string; body: string }>;
}) {
  if (!env.VAPI_API_KEY) return "";
  const history = input.threadHistory
    .slice(-12)
    .reverse()
    .map((message) => `${message.direction === "INBOUND" ? "Customer" : "Agent"}: ${message.body}`)
    .join("\n");

  const conversationPrompt = [
    `Business: ${input.orgName}`,
    `Organization ID: ${input.orgId}`,
    `Inbound SMS from: ${input.fromNumber}`,
    `Business SMS number: ${input.toNumber}`,
    history ? `Recent thread:\n${history}` : "",
    `Latest customer message: ${input.body}`,
    "Respond as the business assistant over SMS in 1-3 short lines. Ask one relevant next question if details are missing."
  ]
    .filter(Boolean)
    .join("\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch("https://api.vapi.ai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VAPI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        assistantId: input.assistantId,
        input: conversationPrompt,
        metadata: {
          orgId: input.orgId,
          channel: "sms",
          fromNumber: input.fromNumber,
          toNumber: input.toNumber
        }
      }),
      signal: controller.signal
    });

    if (response.ok) {
      const payload = (await response.json()) as unknown;
      return extractAssistantReply(payload);
    }

    // Backward-compat fallback for older Vapi route shape.
    const fallback = await fetch(`https://api.vapi.ai/assistant/${input.assistantId}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VAPI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: conversationPrompt,
        metadata: {
          orgId: input.orgId,
          channel: "sms",
          fromNumber: input.fromNumber,
          toNumber: input.toNumber
        }
      }),
      signal: controller.signal
    });
    if (!fallback.ok) return "";
    const payload = (await fallback.json()) as unknown;
    return extractAssistantReply(payload);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

smsRouter.post("/", verifyTwilioRequest, async (req, res) => {
  const toNumberRaw = pickString(req.body.To, req.body.Called, req.body.Recipient, "");
  const fromNumberRaw = pickString(req.body.From, req.body.WaId, "");
  const toNumber = normalizePhone(toNumberRaw);
  const fromNumber = normalizePhone(fromNumberRaw);
  const body = String((req.body.Body as string | undefined) || "").trim();
  const messageSid = String((req.body.MessageSid as string | undefined) || "");
  const toDigits = toNumber.replace(/\D/g, "");
  const toLast10 = toDigits.slice(-10);
  let orgPhone = await prisma.phoneNumber.findFirst({
    where: {
      status: { not: "RELEASED" },
      OR: [
        { e164Number: toNumber },
        ...(toLast10.length === 10 ? [{ e164Number: { endsWith: toLast10 } }] : [])
      ]
    },
    include: { organization: { include: { businessSettings: true } } }
  });

  if (!orgPhone && toNumber) {
    const active = await prisma.phoneNumber.findMany({
      where: { status: { not: "RELEASED" } },
      include: { organization: { include: { businessSettings: true } } },
      take: 500
    });
    orgPhone =
      active.find((row) => normalizePhone(row.e164Number) === toNumber) ||
      (toLast10.length === 10
        ? active.find((row) => normalizePhone(row.e164Number).replace(/\D/g, "").endsWith(toLast10))
        : null) ||
      null;
  }
  const response = new Twiml.MessagingResponse();
  if (!orgPhone?.organization) {
    response.message("This SMS line is not configured.");
    return res.type("text/xml").send(response.toString());
  }

  const orgId = orgPhone.organization.id;
  const normalizedFrom = fromNumber;
  const incomingKeyword = classifySmsKeyword(body);
  const fromPhoneVariants = phoneVariants(fromNumber);
  const existingLead = await prisma.lead.findFirst({
    where: { orgId, phone: { in: fromPhoneVariants } },
    select: { id: true, name: true, dnc: true }
  });

  const thread = await prisma.messageThread.upsert({
    where: {
      orgId_channel_contactPhone: {
        orgId,
        channel: "SMS",
        contactPhone: normalizedFrom
      }
    },
    update: {
      leadId: existingLead?.id || undefined,
      contactName: existingLead?.name || undefined,
      lastMessageAt: new Date()
    },
    create: {
      orgId,
      channel: "SMS",
      contactPhone: normalizedFrom,
      contactName: existingLead?.name || null,
      leadId: existingLead?.id || null,
      lastMessageAt: new Date()
    }
  });

  const existingMessageCount = await prisma.message.count({
    where: { threadId: thread.id }
  });
  const isFirstInbound = existingMessageCount === 0;

  await prisma.message.create({
    data: {
      threadId: thread.id,
      orgId,
      leadId: existingLead?.id || null,
      direction: "INBOUND",
      status: "RECEIVED",
      body: body || "(empty sms)",
      provider: "TWILIO",
      providerMessageId: messageSid || null,
      fromNumber: normalizedFrom,
      toNumber: toNumber || null
    }
  });

  if (incomingKeyword === "STOP") {
    await prisma.lead.updateMany({
      where: {
        orgId,
        OR: [
          { id: existingLead?.id || "" },
          { phone: { in: fromPhoneVariants } }
        ]
      },
      data: { dnc: true }
    });
    const reply = "You are unsubscribed from SMS updates. Reply START to opt back in.";
    await prisma.message.create({
      data: {
        threadId: thread.id,
        orgId,
        leadId: existingLead?.id || null,
        direction: "OUTBOUND",
        status: "SENT",
        body: reply,
        provider: "TWILIO",
        fromNumber: toNumber || null,
        toNumber: normalizedFrom,
        metadataJson: JSON.stringify({ source: "sms_opt_out" }),
        sentAt: new Date()
      }
    });
    await prisma.auditLog.create({
      data: {
        orgId,
        actorUserId: "twilio-sms",
        actorRole: "SYSTEM",
        action: "SMS_OPT_OUT",
        metadataJson: JSON.stringify({ from: normalizedFrom })
      }
    });
    response.message(reply);
    return res.type("text/xml").send(response.toString());
  }

  if (incomingKeyword === "START") {
    await prisma.lead.updateMany({
      where: {
        orgId,
        OR: [
          { id: existingLead?.id || "" },
          { phone: { in: fromPhoneVariants } }
        ]
      },
      data: { dnc: false }
    });
    const reply = `SMS updates are re-enabled for ${orgPhone.organization.name}. How can we help today?`;
    await prisma.message.create({
      data: {
        threadId: thread.id,
        orgId,
        leadId: existingLead?.id || null,
        direction: "OUTBOUND",
        status: "SENT",
        body: reply,
        provider: "TWILIO",
        fromNumber: toNumber || null,
        toNumber: normalizedFrom,
        metadataJson: JSON.stringify({ source: "sms_opt_in" }),
        sentAt: new Date()
      }
    });
    await prisma.auditLog.create({
      data: {
        orgId,
        actorUserId: "twilio-sms",
        actorRole: "SYSTEM",
        action: "SMS_OPT_IN",
        metadataJson: JSON.stringify({ from: normalizedFrom })
      }
    });
    response.message(reply);
    return res.type("text/xml").send(response.toString());
  }

  if (incomingKeyword === "HELP") {
    const reply = `Precision Home Services support: call ${toNumber || "our office"} for immediate help. Reply STOP to opt out.`;
    await prisma.message.create({
      data: {
        threadId: thread.id,
        orgId,
        leadId: existingLead?.id || null,
        direction: "OUTBOUND",
        status: "SENT",
        body: reply,
        provider: "TWILIO",
        fromNumber: toNumber || null,
        toNumber: normalizedFrom,
        metadataJson: JSON.stringify({ source: "sms_help" }),
        sentAt: new Date()
      }
    });
    response.message(reply);
    return res.type("text/xml").send(response.toString());
  }

  if (existingLead?.dnc) {
    const reply = "You are currently opted out of SMS updates. Reply START to re-enable texting.";
    response.message(reply);
    return res.type("text/xml").send(response.toString());
  }

  const proMessagingEnabled = await hasProMessaging(prisma, orgId);
  const orgStatus = String(orgPhone.organization.status || "").toUpperCase();
  const runtimeEnabled = orgPhone.organization.live || orgStatus === "LIVE" || orgStatus === "TESTING";
  const firstInboundIntro =
    isFirstInbound && !incomingKeyword
      ? buildFirstInboundIntro({
          businessName: orgPhone.organization.name,
          policiesJson: orgPhone.organization.businessSettings?.policiesJson,
          smsConsentText: orgPhone.organization.businessSettings?.smsConsentText
        })
      : "";
  if (!runtimeEnabled) {
    const setupReply = `Thanks for contacting ${orgPhone.organization.name}. Your account is in setup mode and we'll follow up soon.`;
    response.message(firstInboundIntro ? `${firstInboundIntro}\n\n${setupReply}` : setupReply);
    return res.type("text/xml").send(response.toString());
  }

  if (!proMessagingEnabled) {
    const nonProReply =
      `Thanks for contacting ${orgPhone.organization.name}. Messaging automation is currently unavailable on this plan. Please call us and our team will follow up.`
    ;
    response.message(firstInboundIntro ? `${firstInboundIntro}\n\n${nonProReply}` : nonProReply);
    return res.type("text/xml").send(response.toString());
  }

  const aiConfig = await prisma.aiAgentConfig.findUnique({
    where: { orgId },
    select: { vapiAgentId: true }
  });
  const threadWithMessages = await prisma.messageThread.findUnique({
    where: { id: thread.id },
    select: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { direction: true, body: true }
      }
    }
  });

  const vapiReply =
    aiConfig?.vapiAgentId?.trim()
      ? await getVapiSmsReply({
          assistantId: aiConfig.vapiAgentId.trim(),
          orgId,
          orgName: orgPhone.organization.name,
          fromNumber: normalizedFrom,
          toNumber: toNumber || "",
          body: body || "",
          threadHistory:
            threadWithMessages?.messages.map((message) => ({
              direction: message.direction,
              body: message.body
            })) || []
        })
      : "";

  const consentText = orgPhone.organization.businessSettings?.smsConsentText?.trim() || "";
  const fallback = `Thanks for contacting ${orgPhone.organization.name}. We received your message and will follow up shortly.`;
  const baseReply = `${vapiReply || fallback}${consentText ? ` ${consentText}` : ""}`.trim();
  const outboundBody = firstInboundIntro ? `${firstInboundIntro}\n\n${baseReply}` : baseReply;

  await prisma.message.create({
    data: {
      threadId: thread.id,
      orgId,
      leadId: existingLead?.id || null,
      direction: "OUTBOUND",
      status: "SENT",
      body: outboundBody,
      provider: "TWILIO",
      fromNumber: toNumber || null,
      toNumber: normalizedFrom,
      metadataJson: JSON.stringify({
        source: vapiReply ? "vapi_sms_chat" : "sms_fallback"
      }),
      sentAt: new Date()
    }
  });

  await prisma.messageThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date() }
  });

  response.message(outboundBody);
  return res.type("text/xml").send(response.toString());
});

smsRouter.post("/status", verifyTwilioRequest, async (req, res) => {
  const messageSid = String(req.body.MessageSid || "").trim();
  const statusRaw = String(req.body.MessageStatus || "").trim();
  const errorCode = String(req.body.ErrorCode || "").trim();
  const errorMessage = String(req.body.ErrorMessage || "").trim();
  const orgIdFromQuery = typeof req.query.orgId === "string" ? req.query.orgId.trim() : "";

  if (!messageSid) return res.json({ ok: true, ignored: true });

  let resolvedOrgId = orgIdFromQuery;
  if (!resolvedOrgId) {
    const candidate = await prisma.message.findFirst({
      where: { providerMessageId: messageSid },
      select: { orgId: true },
      orderBy: { createdAt: "desc" }
    });
    resolvedOrgId = candidate?.orgId || "";
  }

  const nextStatus = mapTwilioMessageStatus(statusRaw);
  const errorText = errorCode || errorMessage ? `Twilio ${errorCode} ${errorMessage}`.trim() : null;

  if (resolvedOrgId) {
    await prisma.message.updateMany({
      where: { orgId: resolvedOrgId, providerMessageId: messageSid },
      data: {
        status: nextStatus,
        errorText,
        deliveredAt: nextStatus === "DELIVERED" ? new Date() : undefined
      }
    });
  } else {
    await prisma.message.updateMany({
      where: { providerMessageId: messageSid },
      data: {
        status: nextStatus,
        errorText,
        deliveredAt: nextStatus === "DELIVERED" ? new Date() : undefined
      }
    });
  }

  return res.json({ ok: true });
});
