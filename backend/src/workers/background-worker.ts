import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { runOutreachRunnerTick } from "../modules/outreach/outreach-runner.service";
import { runFinalizeBookingWorkerTick } from "../modules/voice/vapi/vapi-booking-finalizer.service";
import { runSlaMonitorTick } from "../modules/ops/sla-monitor.service";
import { runDataIntegrityGuardTick } from "../modules/ops/data-integrity-guard.service";
import { runAdminReportsTick } from "../modules/admin/admin-reporting.service";
import { runJobReconciliationTick } from "../modules/ops/reconciliation.service";

/**
 * Global Background Tasks Worker.
 * Replaces unreliable setInterval loops with BullMQ recurring jobs.
 */
export const backgroundWorker = new Worker(
  "background-tasks",
  async (job: Job) => {
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
    }
  },
  { 
    connection: redis as any,
    concurrency: 2
  }
);
