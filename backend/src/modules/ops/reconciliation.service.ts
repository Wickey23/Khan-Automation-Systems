import { PrismaClient } from "@prisma/client";
import { calendarSyncQueue, importQueue } from "../../lib/queue";

/**
 * Reconciliation Service
 * 
 * Audits for "Stale" background job states where a DB record exists
 * but the BullMQ job might have been lost due to enqueue failure
 * or server crash before enqueue.
 */
export async function runJobReconciliationTick(prisma: PrismaClient) {
  console.log("[Reconciliation] Starting job reconciliation audit...");

  // 1. Re-enqueue stuck Appointment Syncs
  // Find PENDING appointments older than 10 minutes
  const stuckAppointments = await prisma.appointment.findMany({
    where: {
      calendarProvider: { not: "INTERNAL" },
      externalSyncStatus: "PENDING",
      createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) }
    },
    take: 50
  });

  for (const appt of stuckAppointments) {
    console.warn(`[Reconciliation] Found stuck appointment ${appt.id}. Re-enqueuing.`);
    await calendarSyncQueue.add("sync-appointment", {
      appointmentId: appt.id,
      orgId: appt.orgId
    }, {
      jobId: `recon-sync-${appt.id}` // Idempotent re-enqueue
    });
  }

  // 2. Re-enqueue stuck Bulk Import Jobs
  // Find QUEUED jobs older than 10 minutes
  const stuckImports = await prisma.bulkImportJob.findMany({
    where: {
      status: "QUEUED",
      createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) }
    },
    take: 20
  });

  for (const job of stuckImports) {
    console.warn(`[Reconciliation] Found stuck import job ${job.id}. Re-enqueuing.`);
    
    // Recovery: Durable sourceData exists, so we can re-enqueue
    await importQueue.add("bulk-import", {
      jobId: job.id,
      orgId: job.orgId
    }, {
      jobId: `recon-import-${job.id}` // Idempotent re-enqueue
    });
  }

  console.log(`[Reconciliation] Audit complete. Handled ${stuckAppointments.length} appointments.`);
}
