import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { sendSmsMessage } from "../modules/twilio/twilio.service";
import { getVapiSmsReply, normalizePhone } from "../modules/sms/sms-utils.service";
import { assertOrgSmsQuota } from "../modules/sms/sms-governance.service";
import { env } from "../config/env";
import { isSystemDisabled } from "../lib/system-flags";

export const aiReplyWorker = new Worker(
  "ai-reply",
  async (job: Job) => {
    const { orgId, fromNumber, toNumber, body, threadId } = job.data;

    // 1. Check Kill Switch
    const killSwitch = await isSystemDisabled("disableMessaging");
    if (killSwitch) {
      console.warn(`[AiReplyWorker] SMS sending is disabled via kill switch. Skipping reply to ${fromNumber}`);
      return;
    }

    // 2. Thread-level Idempotency: Has an AI reply already been sent for this message?
    // We check the job ID first (BullMQ handles this), but we also check the DB 
    // to handle cases where the job might have partially succeeded before crashing.
    const existingReply = await prisma.message.findFirst({
      where: {
        threadId,
        direction: "OUTBOUND",
        metadataJson: { contains: "ai_reply_worker" },
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 mins
      }
    });

    if (existingReply) {
      console.log(`[AiReplyWorker] Already sent a reply to ${fromNumber} recently, skipping.`);
      return;
    }

    // 3. Org Scoping & Quota Check
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { aiAgentConfigs: true }
    });

    if (!org || !org.aiAgentConfigs[0]?.vapiAgentId) {
      console.warn(`[AiReplyWorker] No AI config for org ${orgId}. skipping.`);
      return;
    }

    const quota = await assertOrgSmsQuota({
      prisma,
      orgId,
      actorUserId: "system-ai",
      actorRole: "SYSTEM",
      source: "ai_reply_worker"
    });

    if (!quota.ok) {
      console.warn(`[AiReplyWorker] Quota exceeded for org ${orgId}. skipping.`);
      return;
    }

    // 4. AI Generation (Slow step)
    try {
      const aiReply = await getVapiSmsReply({
        assistantId: org.aiAgentConfigs[0].vapiAgentId,
        orgId,
        orgName: org.name,
        fromNumber,
        toNumber,
        body,
        threadHistory: [] // Could be enhanced to fetch history
      });

      if (!aiReply) {
        console.log(`[AiReplyWorker] AI decided not to reply to ${fromNumber}`);
        return;
      }

      // 5. Send Message
      const statusCallbackUrl = `${env.API_BASE_URL}/api/twilio/sms/status?orgId=${encodeURIComponent(orgId)}`;
      const sent = await sendSmsMessage({
        from: toNumber,
        to: fromNumber,
        body: aiReply,
        statusCallbackUrl
      });

      // 6. Audit Log / Persistence
      await prisma.message.create({
        data: {
          orgId,
          threadId,
          direction: "OUTBOUND",
          status: "SENT",
          body: aiReply,
          fromNumber: toNumber,
          toNumber: fromNumber,
          provider: "TWILIO",
          providerMessageId: sent.sid || null,
          sentAt: new Date(),
          metadataJson: JSON.stringify({ source: "ai_reply_worker" })
        }
      });

      console.log(`[AiReplyWorker] Sent AI reply to ${fromNumber}`);
    } catch (error) {
      console.error(`[AiReplyWorker] AI completion or send failed for ${fromNumber}:`, error);
      throw error; // BullMQ handles backoff
    }
  },
  {
    connection: redis as any,
    concurrency: 5
  }
);
