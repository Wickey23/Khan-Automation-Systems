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
      connectedAt: new Date()
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
          streamStatus: "DISCONNECTED"
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
          streamStatus: "ERROR"
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
    input.socketState.set(input.ws, state);

    void startTranscriptionForMediaStream({ streamSessionId: session.id }).catch(() => null);

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
    try {
      const session = await recordVoiceMediaStreamMediaEvent({
        prisma: input.prisma,
        streamSid: parsed.data.streamSid,
        track: parsed.data.media.track,
        eventAt: new Date(),
        sequenceNumber: parseOptionalSequenceNumber(parsed.data.sequenceNumber)
      });
      const isFirstPacket = session.mediaEventCount === 1;
      if (isFirstPacket) {
        logVoiceMediaStreamEvent({
          endpoint: `ws:${getStreamPath()}`,
          eventType: "MEDIA_STREAM_MEDIA_FIRST_PACKET",
          status: "OK",
          orgId: session.orgId,
          callLogId: session.callLogId,
          providerCallId: session.callSid,
          streamSid: session.streamSid,
          streamStatus: session.streamStatus,
          trackStrategy: session.trackStrategy,
        track: parsed.data.media.track,
        payloadSize: Buffer.byteLength(parsed.data.media.payload, "utf8")
      });
      }
      void forwardMediaFrameToTranscription({
        streamSid: parsed.data.streamSid,
        track: parsed.data.media.track.includes("outbound") ? "outbound_track" : "inbound_track",
        payloadBase64: parsed.data.media.payload,
        sequenceNumber: parseOptionalSequenceNumber(parsed.data.sequenceNumber),
        timestampMs: parseOptionalSequenceNumber(parsed.data.media.timestamp)
      }).catch(() => null);
      const stateRef = input.socketState.get(input.ws);
      if (stateRef) {
        stateRef.orgId = session.orgId;
        stateRef.callLogId = session.callLogId;
        stateRef.providerCallId = session.callSid;
        stateRef.streamSid = session.streamSid;
        input.socketState.set(input.ws, stateRef);
      }
    } catch {
      logVoiceMediaStreamEvent({
        endpoint: `ws:${getStreamPath()}`,
        eventType: "MEDIA_STREAM_SOCKET_ERROR",
        status: "WARN",
        reason: "media_before_start_or_unknown_stream",
        streamSid: parsed.data.streamSid
      });
    }
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
      sequenceNumber: parseOptionalSequenceNumber(parsed.data.sequenceNumber)
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
