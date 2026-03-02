import { Router } from "express";
import { twiml as Twiml } from "twilio";
import { prisma } from "../../lib/prisma";
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

smsRouter.post("/", verifyTwilioRequest, async (req, res) => {
  const toNumber = (req.body.To as string | undefined) || "";
  const fromNumber = (req.body.From as string | undefined) || "";
  const body = String((req.body.Body as string | undefined) || "").trim();
  const messageSid = String((req.body.MessageSid as string | undefined) || "");
  const orgPhone = await prisma.phoneNumber.findFirst({
    where: { e164Number: toNumber, status: { not: "RELEASED" } },
    include: { organization: { include: { businessSettings: true } } }
  });
  const response = new Twiml.MessagingResponse();
  if (!orgPhone?.organization) {
    response.message("This SMS line is not configured.");
    return res.type("text/xml").send(response.toString());
  }

  const orgId = orgPhone.organization.id;
  const normalizedFrom = normalizePhone(fromNumber);
  const existingLead = await prisma.lead.findFirst({
    where: { orgId, phone: normalizedFrom },
    select: { id: true, name: true }
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

  const proMessagingEnabled = await hasProMessaging(prisma, orgId);
  if (!orgPhone.organization.live || orgPhone.organization.status !== "LIVE") {
    response.message(`Thanks for contacting ${orgPhone.organization.name}. Your account is in setup mode and we'll follow up soon.`);
    return res.type("text/xml").send(response.toString());
  }

  if (!proMessagingEnabled) {
    response.message(
      `Thanks for contacting ${orgPhone.organization.name}. Messaging automation is currently unavailable on this plan. Please call us and our team will follow up.`
    );
    return res.type("text/xml").send(response.toString());
  }

  const consentText = orgPhone.organization.businessSettings?.smsConsentText?.trim() || "";
  const suffix = consentText ? ` ${consentText}` : "";
  response.message(`Thanks for contacting ${orgPhone.organization.name}. We received your message and will follow up shortly.${suffix}`);
  return res.type("text/xml").send(response.toString());
});
