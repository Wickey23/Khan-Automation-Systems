import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { runOutreachRunnerTick } from "../modules/outreach/outreach-runner.service";
import { runFinalizeBookingWorkerTick } from "../modules/voice/vapi/vapi-booking-finalizer.service";
import { runSlaMonitorTick } from "../modules/ops/sla-monitor.service";
import { runDataIntegrityGuardTick } from "../modules/ops/data-integrity-guard.service";
import { runAdminReportsTick } from "../modules/admin/admin-reporting.service";
import { runJobReconciliationTick } from "../modules/ops/reconciliation.service";
import { acquireLock, releaseLock } from "../lib/lock";

function lockTtlForJob(name: string) {
  switch (name) {
    case "booking-finalizer":
      return 90_000;
    case "outreach-runner":
      return 10 * 60_000;
    case "data-integrity":
      return 10 * 60_000;
    case "admin-reports":
      return 30 * 60_000;
    default:
      return 3 * 60_000;
  }
}

/**
 * Global Background Tasks Worker.
 * Replaces unreliable setInterval loops with BullMQ recurring jobs.
 */
export const backgroundWorker = new Worker(
  "background-tasks",
  async (job: Job) => {
    const lockKey = `background-job:${job.name}`;
    const lockAcquired = await acquireLock(lockKey, lockTtlForJob(job.name));
    if (!lockAcquired) {
      console.log(`[BackgroundWorker] Skipping ${job.name}; lock not acquired.`);
      return;
    }

    console.log(`[BackgroundWorker] Running job: ${job.name}`);

    try {
      switch (job.name) {
        case "outreach-runner":
          await runOutreachRunnerTick(prisma as any);
          break;
        case "booking-finalizer":
          await runFinalizeBookingWorkerTick(prisma as any);
          break;
        case "sla-monitor":
          await runSlaMonitorTick(prisma as any);
          break;
        case "data-integrity":
          await runDataIntegrityGuardTick(prisma as any);
          break;
        case "admin-reports":
          await runAdminReportsTick(prisma as any);
          break;
        case "job-reconciliation":
          await runJobReconciliationTick(prisma as any);
          break;
        default:
          console.warn(`[BackgroundWorker] Unknown job name: ${job.name}`);
      }
    } catch (error) {
      console.error(`[BackgroundWorker] Job ${job.name} failed:`, error);
      throw error;
    } finally {
      await releaseLock(lockKey);
    }
  },
  { 
    connection: redis as any,
    concurrency: 1
  }
);
