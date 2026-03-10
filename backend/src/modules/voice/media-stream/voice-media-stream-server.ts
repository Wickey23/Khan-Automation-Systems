import type { IncomingMessage, Server } from "http";
import crypto from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { env } from "../../../config/env";
import {
  normalizeCustomParameters,
  parseOptionalSequenceNumber,
  twilioKnownMediaEnvelopeSchema,
  twilioMediaEnvelopeSchema
} from "./voice-media-stream-parser";
import {
  createOrUpdateVoiceMediaStreamSessionFromStart,
  recordVoiceMediaStreamMediaEvent,
  recordVoiceMediaStreamStop
} from "./voice-media-stream-session.service";
import { logVoiceMediaStreamEvent } from "./voice-media-stream-logger";
import { verifyVoiceMediaStreamToken, validateTwilioMediaStreamUpgradeSignature } from "./voice-media-stream-security";
import {
  forwardMediaFrameToTranscription,
  startTranscriptionForMediaStream,
  stopTranscriptionForStream
} from "../transcription/transcription-session.service";

type SocketState = {
  socketId: string;
  connectedAt: Date;
  orgId?: string | null;
  callLogId?: string | null;
  providerCallId?: string | null;
  streamSid?: string | null;
  startInFlight?: boolean;
  pendingMedia?: Array<{
    streamSid: string;
    track: string;
    payload: string;
    sequenceNumber: number | null;
    timestampMs: number | null;
  }>;
  pendingMediaOverflowLogged?: boolean;
  mediaAggregate?: {
    firstPacketPersisted: boolean;
    firstPacketPersisting?: boolean;
    mediaEventCount: number;
    inboundChunkCount: number;
    outboundChunkCount: number;
    mediaStartedAt: Date | null;
    lastMediaAt: Date | null;
  };
};

function getStreamPath() {
  return env.TWILIO_MEDIA_STREAM_PATH || "/ws/twilio/voice-media";
}

export function attachVoiceMediaStreamServer(input: { server: Server; prisma: PrismaClient }) {
  const wss = new WebSocketServer({ noServer: true });
  const socketState = new WeakMap<WebSocket, SocketState>();

  input.server.on("upgrade", (req, socket, head) => {
    const pathName = String(req.url || "").split("?")[0];
    if (pathName !== getStreamPath()) return;

    if (!validateTwilioMediaStreamUpgradeSignature(req)) {
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_UPGRADE_REJECTED",
        reason: "invalid_twilio_signature",
        status: "ERROR"
      });
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const state: SocketState = {
      socketId: crypto.randomUUID(),
      connectedAt: new Date(),
      startInFlight: false,
      pendingMedia: [],
      mediaAggregate: {
        firstPacketPersisted: false,
        firstPacketPersisting: false,
        mediaEventCount: 0,
        inboundChunkCount: 0,
        outboundChunkCount: 0,
        mediaStartedAt: null,
        lastMediaAt: null
      }
    };
    socketState.set(ws, state);

    logVoiceMediaStreamEvent({
      endpoint: `ws:${getStreamPath()}`,
      eventType: "MEDIA_STREAM_UPGRADE_ACCEPTED",
      status: "OK"
    });

    ws.on("message", (raw: RawData) => {
      void handleStreamMessage({ ws, raw: raw.toString("utf8"), prisma: input.prisma, socketState });
    });

    ws.on("close", (code, reasonBuffer) => {
      const current = socketState.get(ws);
      const reason = reasonBuffer?.toString("utf8") || `socket_closed_${code}`;
      if (current?.streamSid) {
        void recordVoiceMediaStreamStop({
          prisma: input.prisma,
          streamSid: current.streamSid,
          stopAt: new Date(),
          stopReason: reason,
          streamStatus: "DISCONNECTED",
          mediaEventCount: current.mediaAggregate?.mediaEventCount ?? undefined,
          inboundChunkCount: current.mediaAggregate?.inboundChunkCount ?? undefined,
          outboundChunkCount: current.mediaAggregate?.outboundChunkCount ?? undefined,
          mediaStartedAt: current.mediaAggregate?.mediaStartedAt ?? undefined,
          lastMediaAt: current.mediaAggregate?.lastMediaAt ?? undefined
        })
          .then(() => stopTranscriptionForStream({ streamSid: current.streamSid as string, reason }))
          .catch(() => null);
      }
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_SOCKET_CLOSED",
        status: "WARN",
        orgId: current?.orgId || null,
        callLogId: current?.callLogId || null,
        providerCallId: current?.providerCallId || null,
        streamSid: current?.streamSid || null,
        reason
      });
    });

    ws.on("error", (error) => {
      const current = socketState.get(ws);
      if (current?.streamSid) {
        void recordVoiceMediaStreamStop({
          prisma: input.prisma,
          streamSid: current.streamSid,
          stopAt: new Date(),
          stopReason: error.message,
          streamStatus: "ERROR",
          mediaEventCount: current.mediaAggregate?.mediaEventCount ?? undefined,
          inboundChunkCount: current.mediaAggregate?.inboundChunkCount ?? undefined,
          outboundChunkCount: current.mediaAggregate?.outboundChunkCount ?? undefined,
          mediaStartedAt: current.mediaAggregate?.mediaStartedAt ?? undefined,
          lastMediaAt: current.mediaAggregate?.lastMediaAt ?? undefined
        })
          .then(() => stopTranscriptionForStream({ streamSid: current.streamSid as string, reason: error.message, errored: true }))
          .catch(() => null);
      }
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_SOCKET_ERROR",
        status: "ERROR",
        orgId: current?.orgId || null,
        callLogId: current?.callLogId || null,
        providerCallId: current?.providerCallId || null,
        streamSid: current?.streamSid || null,
        message: error.message
      });
    });
  });

  return wss;
}

async function handleStreamMessage(input: {
  ws: WebSocket;
  raw: string;
  prisma: PrismaClient;
  socketState: WeakMap<WebSocket, SocketState>;
}) {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.raw);
  } catch {
    logVoiceMediaStreamEvent({
      endpoint: `ws:${getStreamPath()}`,
      eventType: "MEDIA_STREAM_SOCKET_ERROR",
      status: "WARN",
      reason: "invalid_json"
    });
    return;
  }

  const envelope = twilioMediaEnvelopeSchema.safeParse(parsedJson);
  if (!envelope.success) {
    logVoiceMediaStreamEvent({
      endpoint: `ws:${getStreamPath()}`,
      eventType: "MEDIA_STREAM_SOCKET_ERROR",
      status: "WARN",
      reason: "invalid_payload_shape"
    });
    return;
  }
  const parsed = twilioKnownMediaEnvelopeSchema.safeParse(parsedJson);
  if (!parsed.success) {
    logVoiceMediaStreamEvent({
      endpoint: `ws:${getStreamPath()}`,
      eventType: "MEDIA_STREAM_UNKNOWN_EVENT",
      status: "WARN",
      reason: String(envelope.data.event || "unknown")
    });
    return;
  }

  const state = input.socketState.get(input.ws) || { socketId: crypto.randomUUID(), connectedAt: new Date() };
  input.socketState.set(input.ws, state);

  if (parsed.data.event === "connected") {
    logVoiceMediaStreamEvent({
      endpoint: `ws:${getStreamPath()}`,
      eventType: "MEDIA_STREAM_CONNECTED",
      status: "OK",
      streamSid: parsed.data.streamSid ?? null
    });
    return;
  }

  if (parsed.data.event === "start") {
    state.startInFlight = true;
    input.socketState.set(input.ws, state);
    const customParameters = normalizeCustomParameters(parsed.data.start.customParameters);
    const tokenPayload = verifyVoiceMediaStreamToken(customParameters.token || null);
    if (!tokenPayload) {
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_TOKEN_INVALID",
        status: "ERROR",
        reason: "token_invalid"
      });
      input.ws.close();
      return;
    }

    const expectedCallSid = tokenPayload.providerCallId;
    if (parsed.data.start.callSid !== expectedCallSid) {
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_CALL_ASSOCIATION_FAILED",
        status: "ERROR",
        reason: "call_sid_mismatch",
        providerCallId: expectedCallSid
      });
      input.ws.close();
      return;
    }

    const callLog = await input.prisma.callLog.findFirst({
      where: { id: tokenPayload.callLogId, orgId: tokenPayload.orgId, providerCallId: expectedCallSid },
      select: { id: true, orgId: true, providerCallId: true, parentCallSid: true }
    });
    if (!callLog) {
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_CALL_ASSOCIATION_FAILED",
        status: "ERROR",
        reason: "call_log_not_found",
        providerCallId: expectedCallSid,
        callLogId: tokenPayload.callLogId,
        orgId: tokenPayload.orgId
      });
      input.ws.close();
      return;
    }

    const streamSid = parsed.data.start.streamSid || parsed.data.streamSid || null;
    if (!streamSid) {
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_CALL_ASSOCIATION_FAILED",
        status: "ERROR",
        reason: "missing_stream_sid",
        providerCallId: expectedCallSid,
        callLogId: tokenPayload.callLogId,
        orgId: tokenPayload.orgId
      });
      input.ws.close();
      return;
    }
    const session = await createOrUpdateVoiceMediaStreamSessionFromStart({
      prisma: input.prisma,
      callLogId: callLog.id,
      orgId: callLog.orgId,
      callSid: parsed.data.start.callSid,
      parentCallSid: callLog.parentCallSid,
      streamSid,
      streamName: typeof customParameters.streamName === "string" ? customParameters.streamName : null,
      trackStrategy: "BOTH_TRACKS",
      websocketConnectedAt: state.connectedAt,
      streamMetadata: {
        accountSid: parsed.data.start.accountSid || null,
        mediaFormat: parsed.data.start.mediaFormat || null,
        tracks: parsed.data.start.tracks || null
      } as Prisma.JsonObject,
      customParametersJson: customParameters as Prisma.JsonObject,
      startPayloadJson: parsedJson as Prisma.JsonObject,
      mediaStartedAt: new Date(),
      sequenceNumber: parseOptionalSequenceNumber(parsed.data.sequenceNumber)
    });

    state.orgId = callLog.orgId;
    state.callLogId = callLog.id;
    state.providerCallId = callLog.providerCallId;
    state.streamSid = session.streamSid;
    state.startInFlight = false;
    input.socketState.set(input.ws, state);

    await startTranscriptionForMediaStream({ streamSessionId: session.id }).catch(() => null);

    const pendingMedia = (state.pendingMedia || []).filter((entry) => entry.streamSid === session.streamSid);
    state.pendingMedia = (state.pendingMedia || []).filter((entry) => entry.streamSid !== session.streamSid);
    input.socketState.set(input.ws, state);
    for (const mediaEntry of pendingMedia) {
      await processMediaEvent({
        prisma: input.prisma,
        socketState: input.socketState,
        ws: input.ws,
        state,
        streamSid: mediaEntry.streamSid,
        track: mediaEntry.track,
        payload: mediaEntry.payload,
        sequenceNumber: mediaEntry.sequenceNumber,
        timestampMs: mediaEntry.timestampMs,
        suppressUnknownStreamLog: false
      });
    }

    logVoiceMediaStreamEvent({
      endpoint: `ws:${getStreamPath()}`,
      eventType: "MEDIA_STREAM_STARTED",
      status: "OK",
      orgId: callLog.orgId,
      callLogId: callLog.id,
        providerCallId: callLog.providerCallId,
        streamSid: session.streamSid ?? null,
        trackStrategy: session.trackStrategy,
        streamStatus: session.streamStatus
      });
    return;
  }

  if (parsed.data.event === "media") {
    const sequenceNumber = parseOptionalSequenceNumber(parsed.data.sequenceNumber);
    const timestampMs = parseOptionalSequenceNumber(parsed.data.media.timestamp);
    const shouldBufferEarlyMedia =
      state.startInFlight === true ||
      (!!parsed.data.streamSid && !state.streamSid) ||
      (!!parsed.data.streamSid && state.streamSid === parsed.data.streamSid && (state.pendingMedia?.length || 0) > 0);

    if (shouldBufferEarlyMedia) {
      const pendingMedia = state.pendingMedia || [];
      if (pendingMedia.length < 200) {
        pendingMedia.push({
          streamSid: parsed.data.streamSid,
          track: parsed.data.media.track,
          payload: parsed.data.media.payload,
          sequenceNumber,
          timestampMs
        });
        state.pendingMedia = pendingMedia;
        input.socketState.set(input.ws, state);
      } else if (!state.pendingMediaOverflowLogged) {
        state.pendingMediaOverflowLogged = true;
        input.socketState.set(input.ws, state);
        logVoiceMediaStreamEvent({
          endpoint: `ws:${getStreamPath()}`,
          eventType: "MEDIA_STREAM_SOCKET_ERROR",
          status: "WARN",
          reason: "pending_media_buffer_overflow",
          streamSid: parsed.data.streamSid
        });
      }
      return;
    }

    await processMediaEvent({
      prisma: input.prisma,
      socketState: input.socketState,
      ws: input.ws,
      state,
      streamSid: parsed.data.streamSid,
      track: parsed.data.media.track,
      payload: parsed.data.media.payload,
      sequenceNumber,
      timestampMs,
      suppressUnknownStreamLog: false
    });
    return;
  }

  if (parsed.data.event === "dtmf") {
    logVoiceMediaStreamEvent({
      endpoint: `ws:${getStreamPath()}`,
      eventType: "MEDIA_STREAM_DTMF_IGNORED",
      status: "OK",
      streamSid: parsed.data.streamSid ?? null
    });
    return;
  }

  if (parsed.data.event === "stop") {
    const streamSid = parsed.data.streamSid || state.streamSid;
    if (!streamSid) return;
    const session = await recordVoiceMediaStreamStop({
      prisma: input.prisma,
      streamSid,
      stopAt: new Date(),
      stopReason: parsed.data.stop.reason || "twilio_stop",
      stopPayloadJson: parsedJson as Prisma.JsonObject,
      streamStatus: "STOPPED",
      sequenceNumber: parseOptionalSequenceNumber(parsed.data.sequenceNumber),
      mediaEventCount: state.mediaAggregate?.mediaEventCount ?? undefined,
      inboundChunkCount: state.mediaAggregate?.inboundChunkCount ?? undefined,
      outboundChunkCount: state.mediaAggregate?.outboundChunkCount ?? undefined,
      mediaStartedAt: state.mediaAggregate?.mediaStartedAt ?? undefined,
      lastMediaAt: state.mediaAggregate?.lastMediaAt ?? undefined
    }).catch(() => null);
    logVoiceMediaStreamEvent({
      endpoint: `ws:${getStreamPath()}`,
      eventType: "MEDIA_STREAM_STOPPED",
      status: "OK",
      orgId: session?.orgId || state.orgId || null,
      callLogId: session?.callLogId || state.callLogId || null,
      providerCallId: session?.callSid || state.providerCallId || null,
      streamSid: streamSid ?? null,
      trackStrategy: session?.trackStrategy || null,
      streamStatus: session?.streamStatus || "STOPPED"
    });
    void stopTranscriptionForStream({
      streamSid,
      reason: parsed.data.stop.reason || "twilio_stop"
    }).catch(() => null);
    return;
  }
}

async function processMediaEvent(input: {
  prisma: PrismaClient;
  socketState: WeakMap<WebSocket, SocketState>;
  ws: WebSocket;
  state: SocketState;
  streamSid: string;
  track: string;
  payload: string;
  sequenceNumber: number | null;
  timestampMs: number | null;
  suppressUnknownStreamLog: boolean;
}) {
  try {
    const eventAt = new Date();
    const aggregate = input.state.mediaAggregate || {
      firstPacketPersisted: false,
      firstPacketPersisting: false,
      mediaEventCount: 0,
      inboundChunkCount: 0,
      outboundChunkCount: 0,
      mediaStartedAt: null,
      lastMediaAt: null
    };
    const normalizedTrack = String(input.track || "").toLowerCase();
    const isInbound = normalizedTrack.includes("inbound");
    const isOutbound = normalizedTrack.includes("outbound");

    aggregate.mediaEventCount += 1;
    if (isInbound) aggregate.inboundChunkCount += 1;
    if (isOutbound) aggregate.outboundChunkCount += 1;
    aggregate.mediaStartedAt = aggregate.mediaStartedAt || eventAt;
    aggregate.lastMediaAt = eventAt;

    let session:
      | Awaited<ReturnType<typeof recordVoiceMediaStreamMediaEvent>>
      | null = null;
    const shouldPersistFirstPacket =
      aggregate.firstPacketPersisted === false && aggregate.firstPacketPersisting !== true;
    if (shouldPersistFirstPacket) {
      aggregate.firstPacketPersisting = true;
      input.state.mediaAggregate = aggregate;
      input.socketState.set(input.ws, input.state);
      try {
        session = await recordVoiceMediaStreamMediaEvent({
          prisma: input.prisma,
          streamSid: input.streamSid,
          track: input.track,
          eventAt,
          sequenceNumber: input.sequenceNumber
        });
        aggregate.firstPacketPersisted = true;
      } finally {
        aggregate.firstPacketPersisting = false;
      }
    }

    input.state.mediaAggregate = aggregate;
    input.socketState.set(input.ws, input.state);

    if (shouldPersistFirstPacket && session) {
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_MEDIA_FIRST_PACKET",
        status: "OK",
        orgId: session?.orgId || input.state.orgId || null,
        callLogId: session?.callLogId || input.state.callLogId || null,
        providerCallId: session?.callSid || input.state.providerCallId || null,
        streamSid: session?.streamSid || input.streamSid,
        streamStatus: session?.streamStatus || "ACTIVE",
        trackStrategy: session?.trackStrategy || null,
        track: input.track,
        payloadSize: Buffer.byteLength(input.payload, "utf8")
      });
    }
    void forwardMediaFrameToTranscription({
      streamSid: input.streamSid,
      track: input.track.includes("outbound") ? "outbound_track" : "inbound_track",
      payloadBase64: input.payload,
      sequenceNumber: input.sequenceNumber,
      timestampMs: input.timestampMs
    }).catch(() => null);
    if (session) {
      input.state.orgId = session.orgId;
      input.state.callLogId = session.callLogId;
      input.state.providerCallId = session.callSid;
      input.state.streamSid = session.streamSid;
      input.socketState.set(input.ws, input.state);
    }
  } catch {
    if (!input.suppressUnknownStreamLog) {
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_SOCKET_ERROR",
        status: "WARN",
        reason: "media_before_start_or_unknown_stream",
        streamSid: input.streamSid
      });
    }
  }
}
