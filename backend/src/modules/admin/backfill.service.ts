import type { PrismaClient } from "@prisma/client";

function parseAuditMetadata(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type BackfillResult = {
  scanned: number;
  resolved: number;
  skipped: number;
};

export async function backfillMissedVapiCalls(
  prisma: PrismaClient,
  actorUserId: string,
  filterOrgId?: string
): Promise<BackfillResult> {
  const unresolved = await prisma.auditLog.findMany({
    where: { action: "VAPI_WEBHOOK_UNRESOLVED" },
    orderBy: { createdAt: "asc" },
    take: 500
  });

  let resolved = 0;
  let skipped = 0;

  for (const row of unresolved) {
    try {
      const meta = parseAuditMetadata(row.metadataJson);
      const callSid = String(meta.callSid || "").trim();
      if (!callSid) {
        skipped += 1;
        continue;
      }

      let orgId = String(meta.orgIdFromPayload || "").trim();
      const toNumber = String(meta.toNumber || "").trim();
      const fromNumber = String(meta.fromNumber || "").trim() || "unknown";
      const eventType = String(meta.eventType || "unknown").toLowerCase();
      const callStatus = String(meta.callStatus || "").toLowerCase();
      const endedByStatus = ["ended", "completed", "failed", "canceled", "cancelled", "busy", "no-answer", "timeout"].includes(callStatus);

      if (!orgId && toNumber) {
        const phone = await prisma.phoneNumber.findFirst({
          where: { e164Number: toNumber, status: { not: "RELEASED" } },
          select: { orgId: true }
        });
        orgId = phone?.orgId || "";
      }

      if (!orgId) {
        skipped += 1;
        continue;
      }
      if (filterOrgId && orgId !== filterOrgId) {
        skipped += 1;
        continue;
      }

      const existing = await prisma.callLog.findFirst({
        where: { providerCallId: callSid },
        orderBy: { createdAt: "desc" }
      });

      const updateData: Record<string, unknown> = {
        aiProvider: "VAPI"
      };
      const summary = String(meta.summary || "").trim();
      const transcript = String(meta.transcript || "").trim();
      const recordingUrl = String(meta.recordingUrl || "").trim();
      const outcomeRaw = String(meta.outcome || "").trim().toUpperCase();
      const outcome = ["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"].includes(outcomeRaw)
        ? outcomeRaw
        : null;
      if (summary) updateData.aiSummary = summary;
      if (transcript) updateData.transcript = transcript;
      if (recordingUrl) updateData.recordingUrl = recordingUrl;
      if (outcome) updateData.outcome = outcome;
      if (eventType === "end-of-call-report" || endedByStatus) updateData.endedAt = new Date();

      const log = existing
        ? await prisma.callLog.update({ where: { id: existing.id }, data: updateData })
        : await prisma.callLog.create({
            data: {
              orgId,
              providerCallId: callSid,
              fromNumber,
              toNumber: toNumber || "unknown",
              aiProvider: "VAPI",
              outcome: (outcome || "MESSAGE_TAKEN") as any,
              ...(updateData as Record<string, string | number | boolean | Date | null | undefined>)
            }
          });

      await prisma.auditLog.update({
        where: { id: row.id },
        data: {
          action: "VAPI_WEBHOOK_RESOLVED",
          orgId,
          metadataJson: JSON.stringify({
            ...meta,
            resolvedAt: new Date().toISOString(),
            resolvedByUserId: actorUserId,
            callLogId: log.id
          })
        }
      });

      resolved += 1;
    } catch {
      skipped += 1;
    }
  }

  return {
    scanned: unresolved.length,
    resolved,
    skipped
  };
}
