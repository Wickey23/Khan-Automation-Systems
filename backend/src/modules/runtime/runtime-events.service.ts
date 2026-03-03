import type { PrismaClient } from "@prisma/client";

export type RuntimeEventType =
  | "CALL_STARTED"
  | "CALL_COMPLETED"
  | "CALL_QUALITY_COMPUTED"
  | "AUTO_RECOVERY_SENT"
  | "SLA_THRESHOLD_BREACHED";

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ parseError: true });
  }
}

export async function emitRuntimeEvent(input: {
  prisma: PrismaClient;
  type: RuntimeEventType;
  orgId?: string | null;
  actorUserId?: string;
  actorRole?: string;
  payload?: Record<string, unknown>;
}) {
  await input.prisma.auditLog.create({
    data: {
      orgId: input.orgId || null,
      actorUserId: input.actorUserId || "runtime-events",
      actorRole: input.actorRole || "SYSTEM",
      action: input.type,
      metadataJson: safeStringify(input.payload || {})
    }
  });
}

