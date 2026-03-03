import { CallState, type Prisma, type PrismaClient } from "@prisma/client";
import { emitRuntimeEvent } from "../runtime/runtime-events.service";

const stateOrder: Record<CallState, number> = {
  RINGING: 1,
  CONNECTED: 2,
  AI_ACTIVE: 3,
  TRANSFERRED: 4,
  COMPLETED: 5
};

function timestampFieldForState(state: CallState):
  | "ringingAt"
  | "connectedAt"
  | "aiStartedAt"
  | "transferredAt"
  | "completedAt" {
  if (state === "RINGING") return "ringingAt";
  if (state === "CONNECTED") return "connectedAt";
  if (state === "AI_ACTIVE") return "aiStartedAt";
  if (state === "TRANSFERRED") return "transferredAt";
  return "completedAt";
}

export async function transitionCallState(input: {
  prisma: PrismaClient;
  callLogId: string;
  toState: CallState;
  metadata?: Record<string, unknown>;
  at?: Date;
}) {
  const callLog = await input.prisma.callLog.findUnique({
    where: { id: input.callLogId },
    select: { id: true, orgId: true, state: true, providerCallId: true }
  });
  if (!callLog) return { accepted: false as const, reason: "CALL_NOT_FOUND" };

  const currentState = callLog.state;
  if (currentState === "COMPLETED") return { accepted: false as const, reason: "ALREADY_COMPLETED" };
  if (currentState && stateOrder[input.toState] <= stateOrder[currentState]) {
    return { accepted: false as const, reason: "STALE_TRANSITION" };
  }

  const at = input.at || new Date();
  const timestampField = timestampFieldForState(input.toState);
  await input.prisma.$transaction([
    input.prisma.callLog.update({
      where: { id: input.callLogId },
      data: {
        state: input.toState,
        [timestampField]: at
      }
    }),
    input.prisma.callStateTransition.create({
      data: {
        callLogId: input.callLogId,
        fromState: currentState || null,
        toState: input.toState,
        at,
        metadataJson: (input.metadata || {}) as Prisma.InputJsonValue
      }
    })
  ]);

  await emitRuntimeEvent({
    prisma: input.prisma,
    type: input.toState === "COMPLETED" ? "CALL_COMPLETED" : "CALL_STARTED",
    orgId: callLog.orgId,
    payload: {
      callLogId: callLog.id,
      providerCallId: callLog.providerCallId,
      fromState: currentState || null,
      toState: input.toState,
      at: at.toISOString(),
      metadata: input.metadata || {}
    }
  });

  return { accepted: true as const };
}
