import type { Prisma, PrismaClient } from "@prisma/client";
import {
  type VoiceMediaStreamStatus,
  type VoiceMediaTrackStrategy
} from "./voice-media-stream-constants";

function sequenceUpdate(sequenceNumber: number | null) {
  return sequenceNumber === null ? {} : { lastSequenceNumber: sequenceNumber };
}

export async function createOrUpdateVoiceMediaStreamSessionFromStart(input: {
  prisma: PrismaClient;
  callLogId: string;
  orgId: string;
  callSid: string;
  parentCallSid?: string | null;
  streamSid: string;
  streamName?: string | null;
  trackStrategy: VoiceMediaTrackStrategy;
  websocketConnectedAt?: Date | null;
  streamMetadata?: Prisma.InputJsonValue | null;
  customParametersJson?: Prisma.InputJsonValue | null;
  startPayloadJson?: Prisma.InputJsonValue | null;
  mediaStartedAt?: Date | null;
  sequenceNumber?: number | null;
}) {
  const session = await input.prisma.callMediaStreamSession.upsert({
    where: { streamSid: input.streamSid },
    update: {
      callLogId: input.callLogId,
      orgId: input.orgId,
      callSid: input.callSid,
      parentCallSid: input.parentCallSid || undefined,
      streamName: input.streamName || undefined,
      trackStrategy: input.trackStrategy,
      streamStatus: "STARTED",
      websocketConnectedAt: input.websocketConnectedAt || undefined,
      mediaStartedAt: input.mediaStartedAt || undefined,
      streamMetadata: input.streamMetadata || undefined,
      customParametersJson: input.customParametersJson || undefined,
      startPayloadJson: input.startPayloadJson || undefined,
      ...sequenceUpdate(input.sequenceNumber ?? null)
    },
    create: {
      callLogId: input.callLogId,
      orgId: input.orgId,
      callSid: input.callSid,
      parentCallSid: input.parentCallSid || null,
      streamSid: input.streamSid,
      streamName: input.streamName || null,
      trackStrategy: input.trackStrategy,
      streamStatus: "STARTED",
      websocketConnectedAt: input.websocketConnectedAt || null,
      mediaStartedAt: input.mediaStartedAt || null,
      streamMetadata: input.streamMetadata || undefined,
      customParametersJson: input.customParametersJson || undefined,
      startPayloadJson: input.startPayloadJson || undefined,
      lastSequenceNumber: input.sequenceNumber ?? null
    }
  });

  await input.prisma.callLog.update({
    where: { id: input.callLogId },
    data: {
      hasMediaStream: true,
      latestStreamStatus: "STARTED"
    }
  });

  return session;
}

export async function recordVoiceMediaStreamMediaEvent(input: {
  prisma: PrismaClient;
  streamSid: string;
  track: string;
  eventAt: Date;
  sequenceNumber?: number | null;
}) {
  const track = String(input.track || "").toLowerCase();
  const isInbound = track.includes("inbound");
  const isOutbound = track.includes("outbound");
  const session = await input.prisma.callMediaStreamSession.update({
    where: { streamSid: input.streamSid },
    data: {
      streamStatus: "ACTIVE",
      lastMediaAt: input.eventAt,
      mediaStartedAt: input.eventAt,
      mediaEventCount: { increment: 1 },
      inboundChunkCount: isInbound ? { increment: 1 } : undefined,
      outboundChunkCount: isOutbound ? { increment: 1 } : undefined,
      ...sequenceUpdate(input.sequenceNumber ?? null)
    }
  });

  await input.prisma.callLog.update({
    where: { id: session.callLogId },
    data: { hasMediaStream: true, latestStreamStatus: "ACTIVE" }
  });

  return session;
}

export async function recordVoiceMediaStreamStop(input: {
  prisma: PrismaClient;
  streamSid: string;
  stopAt: Date;
  stopReason?: string | null;
  stopPayloadJson?: Prisma.InputJsonValue | null;
  streamStatus?: VoiceMediaStreamStatus;
  sequenceNumber?: number | null;
  mediaEventCount?: number | null;
  inboundChunkCount?: number | null;
  outboundChunkCount?: number | null;
  mediaStartedAt?: Date | null;
  lastMediaAt?: Date | null;
}) {
  const nextStatus = input.streamStatus || "STOPPED";
  const session = await input.prisma.callMediaStreamSession.update({
    where: { streamSid: input.streamSid },
    data: {
      streamStatus: nextStatus,
      mediaEndedAt: input.stopAt,
      mediaStartedAt: input.mediaStartedAt || undefined,
      lastMediaAt: input.lastMediaAt || undefined,
      mediaEventCount: input.mediaEventCount ?? undefined,
      inboundChunkCount: input.inboundChunkCount ?? undefined,
      outboundChunkCount: input.outboundChunkCount ?? undefined,
      stopReason: input.stopReason || undefined,
      stopPayloadJson: input.stopPayloadJson || undefined,
      ...sequenceUpdate(input.sequenceNumber ?? null)
    }
  });
  await input.prisma.callLog.update({
    where: { id: session.callLogId },
    data: { hasMediaStream: true, latestStreamStatus: nextStatus }
  });
  return session;
}

export async function updateVoiceMediaStreamStatusFromCallback(input: {
  prisma: PrismaClient;
  streamSid: string;
  callbackPayload: Prisma.InputJsonValue;
  streamEvent: "stream-started" | "stream-stopped" | "stream-error";
  stopReason?: string | null;
}) {
  const mappedStatus =
    input.streamEvent === "stream-started" ? "STARTED" : input.streamEvent === "stream-stopped" ? "STOPPED" : "ERROR";
  const session = await input.prisma.callMediaStreamSession.findFirst({
    where: { streamSid: input.streamSid },
    orderBy: { createdAt: "desc" }
  });
  if (!session) return null;
  const updated = await input.prisma.callMediaStreamSession.update({
    where: { id: session.id },
    data: {
      streamStatus: mappedStatus,
      streamMetadata: input.callbackPayload,
      stopReason: input.stopReason || undefined,
      mediaEndedAt:
        input.streamEvent === "stream-stopped" || input.streamEvent === "stream-error" ? new Date() : session.mediaEndedAt
    }
  });
  await input.prisma.callLog.update({
    where: { id: session.callLogId },
    data: { hasMediaStream: true, latestStreamStatus: mappedStatus }
  });
  return updated;
}

export async function reconcileOpenVoiceMediaStreamsForCall(input: {
  prisma: PrismaClient;
  callLogId: string;
  stopReason: string;
}) {
  const openStatuses = ["CONNECTED", "STARTED", "ACTIVE"];
  const sessions = await input.prisma.callMediaStreamSession.findMany({
    where: { callLogId: input.callLogId, streamStatus: { in: openStatuses } },
    select: { id: true }
  });
  if (!sessions.length) return 0;
  await input.prisma.callMediaStreamSession.updateMany({
    where: { id: { in: sessions.map((row) => row.id) } },
    data: {
      streamStatus: "DISCONNECTED",
      stopReason: input.stopReason,
      mediaEndedAt: new Date()
    }
  });
  await input.prisma.callLog.update({
    where: { id: input.callLogId },
    data: { latestStreamStatus: "DISCONNECTED", hasMediaStream: true }
  });
  return sessions.length;
}
