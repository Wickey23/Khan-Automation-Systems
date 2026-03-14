import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { runOutreachPhoneTick } from "./outreach-phone.service";
import { runOutreachTick } from "./outreach.service";

export async function runOutreachRunnerTick(prisma: PrismaClient) {
  const emailResult = await runOutreachTick({
    prisma,
    processingTimeoutMs: Number.parseInt(env.OUTREACH_PROCESSING_TIMEOUT_MS, 10) || 900000,
    dailySendCap: Number.parseInt(env.OUTREACH_DAILY_SEND_CAP, 10) || 40,
    sendWindowStartHour: Number.parseInt(env.OUTREACH_SEND_WINDOW_START_HOUR, 10) || 9,
    sendWindowEndHour: Number.parseInt(env.OUTREACH_SEND_WINDOW_END_HOUR, 10) || 17,
    sendJitterMinutes: Number.parseInt(env.OUTREACH_SEND_JITTER_MINUTES, 10) || 20
  });
  const phoneResult = await runOutreachPhoneTick({
    prisma,
    processingTimeoutMs: Number.parseInt(env.OUTREACH_PROCESSING_TIMEOUT_MS, 10) || 900000
  });
  return {
    processed: emailResult.processed + phoneResult.processed,
    sent: emailResult.sent,
    failed: emailResult.failed + phoneResult.failed,
    phoneStarted: phoneResult.started
  };
}
