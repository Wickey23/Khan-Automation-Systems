import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { createExternalCalendarEvent } from "../modules/appointments/calendar-provider.service";
import { isSystemDisabled } from "../lib/system-flags";

async function syncToCalendarProvider(appointmentId: string, orgId: string): Promise<{ eventId: string }> {
  const result = await createExternalCalendarEvent({
    prisma,
    orgId,
    appointmentId
  });

  return { eventId: result.externalEventId };
}

export const calendarSyncWorker = new Worker(
  "calendar-sync",
  async (job: Job) => {
    const { appointmentId, orgId } = job.data;

    const killSwitch = await isSystemDisabled("disableMessaging"); 
    if (killSwitch) {
      console.warn(`[CalendarWorker] Sync disabled via kill switch. Skipping appointment ${appointmentId}`);
      return;
    }

    try {
      // Use an updateMany with a status filter for atomic claim
      const result = await prisma.appointment.updateMany({
        where: { 
          id: appointmentId,
          externalSyncStatus: "PENDING"
        },
        data: {
          attempts: { increment: 1 }
        }
      });

      if (result.count === 0) {
        console.log(`[Worker] Appointment ${appointmentId} already synced or processing. Skipping.`);
        return;
      }

      const { eventId } = await syncToCalendarProvider(appointmentId, orgId);

      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          externalCalendarEventId: eventId,
          externalSyncStatus: "SYNCED",
          status: "CONFIRMED",
          lastError: null,
          failedAt: null
        }
      });

      console.log(`[Worker] Successfully synced appointment ${appointmentId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      console.error(`[Worker] Calendar sync failed for appointment ${appointmentId}:`, message);

      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          externalSyncStatus: "FAILED",
          lastError: message,
          failedAt: new Date()
        }
      });

      throw error; // Let BullMQ handle retries
    }
  },
  {
    connection: redis as any,
    concurrency: 5
  }
);
