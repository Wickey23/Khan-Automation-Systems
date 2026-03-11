import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { runOutreachTick } from "./outreach.service";

export async function runOutreachRunnerTick(prisma: PrismaClient) {
  return runOutreachTick({
    prisma,
    processingTimeoutMs: Number.parseInt(env.OUTREACH_PROCESSING_TIMEOUT_MS, 10) || 900000
  });
}
