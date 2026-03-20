import { LeadSource } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { twiml as Twiml } from "twilio";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { verifyTwilioRequest } from "../../middleware/webhook-security";
import { registerWebhookReplay } from "../ops/webhook-replay.service";
import { hasProMessaging } from "../billing/plan-features";
import { handleAppointmentRequestSmsReply } from "../appointments/appointment-request-sms.service";
import { maybeEmitWebhookRetryAlert } from "../notifications/security-alert.service";

export const smsRouter = Router();
import { normalizePhone, classifySmsKeyword, buildFirstInboundIntro, getVapiSmsReply } from "./sms-utils.service";

smsRouter.post("/", verifyTwilioRequest, async (req, res) => {
  const response = new Twiml.MessagingResponse();
  const messageSid = String(req.body.MessageSid || "");

  try {
    const { assertSystemEnabled } = await import("../../lib/system-flags");
    await assertSystemEnabled("disableWebhooks");
    await assertSystemEnabled("disableMessaging");

    if (messageSid) {
       // De-duplicate before queuing to prevent queue bloat
       const { executeOnce } = await import("../../lib/idempotency");
       const idempotencyKey = `sms:inbound:${messageSid}`;
       
       await executeOnce({
         key: idempotencyKey,
         ttlMs: 60000, // 1 minute
         handler: async () => {
           // Priority 2: Durable Staging - store in DB, keep out of Redis
           const event = await prisma.smsWebhookEvent.create({
             data: {
               messageSid,
               eventType: "sms-inbound",
               payload: req.body as any,
             }
           });

           const { webhookQueue } = await import("../../lib/queue");
           await webhookQueue.add("twilio-sms-inbound", {
             provider: "twilio",
             type: "twilio_sms_inbound",
             eventId: event.id
           });
         }
       }).catch((err) => {
         if (err.message.includes("Idempotency")) {
           return; // Already processed/queued
         }
         throw err;
       });
    }

    // Always respond 200/Empty TwiML quickly to Twilio.
    // The worker will send any replies via the Twilio API asynchronously.
    return res.type("text/xml").send(response.toString());

  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    
    // If it's a kill switch, we might want to return 503 so Twilio retries later
    if (message.includes("is currently disabled")) {
      return res.status(503).type("text/xml").send(response.toString());
    }

    // For other errors, log and respond 200 so Twilio doesn't keep retrying a broken payload
    return res.type("text/xml").send(response.toString());
  }
});

smsRouter.post("/status", verifyTwilioRequest, async (req, res) => {
  const messageSid = String(req.body.MessageSid || "").trim();

  try {
    const { assertSystemEnabled } = await import("../../lib/system-flags");
    await assertSystemEnabled("disableWebhooks");

    if (messageSid) {
       const statusRaw = String(req.body.MessageStatus || "").trim().toLowerCase();
       const idempotencyKey = `sms:status:${messageSid}:${statusRaw}`;
       
       const { executeOnce } = await import("../../lib/idempotency");
       await executeOnce({
         key: idempotencyKey,
         ttlMs: 60000,
         handler: async () => {
           // Priority 2: Durable Staging
           const event = await prisma.smsWebhookEvent.create({
             data: {
               messageSid,
               eventType: "sms-status",
               payload: req.body as any,
             }
           });

           const { webhookQueue } = await import("../../lib/queue");
           await webhookQueue.add("twilio-sms-status", {
             provider: "twilio",
             type: "twilio_sms_status",
             eventId: event.id
           });
         }
       }).catch((err) => {
         if (err.message.includes("Idempotency")) return;
         throw err;
       });
    }

    return res.json({ ok: true, enqueued: true });

  } catch (error) {
     const message = error instanceof Error ? error.message : "unknown_error";
     if (message.includes("is currently disabled")) {
       return res.status(503).json({ ok: false, message: "Paused" });
     }
     return res.json({ ok: true, error: message });
  }
});
