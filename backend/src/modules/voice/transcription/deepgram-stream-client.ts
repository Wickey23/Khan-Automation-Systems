import { WebSocket } from "ws";
import { env } from "../../../config/env";
import type { NormalizedTranscriptEvent, StreamingTranscriptionAdapter, TranscriptTrack } from "./transcription-adapter";
import { normalizeDeepgramTranscriptEvent } from "./transcription-parser";
import { logTranscriptionEvent } from "./transcription-logger";

type TrackSocketState = {
  track: "inbound_track" | "outbound_track";
  socket: WebSocket;
  open: boolean;
  closed: boolean;
  queue: Buffer[];
};

type RuntimeSession = {
  sessionId: string;
  callLogId: string;
  streamSessionId: string;
  orgId: string;
  trackSockets: Map<"inbound_track" | "outbound_track", TrackSocketState>;
};

type DeepgramClientOptions = {
  onTranscriptEvent: (event: NormalizedTranscriptEvent) => void;
  onProviderError: (input: {
    sessionId: string;
    message: string;
    track?: TranscriptTrack;
  }) => void;
};

function buildDeepgramUrl() {
  const url = new URL("wss://api.deepgram.com/v1/listen");
  url.searchParams.set("encoding", "mulaw");
  url.searchParams.set("sample_rate", "8000");
  url.searchParams.set("channels", "1");
  url.searchParams.set("interim_results", "true");
  url.searchParams.set("punctuate", "true");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("model", "nova-2-phonecall");
  url.searchParams.set("endpointing", "300");
  return url.toString();
}

function closeTrackSocket(trackSocket: TrackSocketState) {
  try {
    if (trackSocket.socket.readyState === WebSocket.OPEN) {
      trackSocket.socket.send(JSON.stringify({ type: "Finalize" }));
      trackSocket.socket.close();
    } else if (trackSocket.socket.readyState === WebSocket.CONNECTING) {
      trackSocket.socket.close();
    }
  } catch {
    // best effort close
  }
}

export function createDeepgramStreamingAdapter(options: DeepgramClientOptions): StreamingTranscriptionAdapter {
  const sessions = new Map<string, RuntimeSession>();

  function createTrackSocket(session: RuntimeSession, track: "inbound_track" | "outbound_track") {
    const socket = new WebSocket(buildDeepgramUrl(), {
      headers: {
        Authorization: `Token ${env.DEEPGRAM_API_KEY || ""}`
      }
    });

    const trackSocket: TrackSocketState = {
      track,
      socket,
      open: false,
      closed: false,
      queue: []
    };
    session.trackSockets.set(track, trackSocket);

    socket.on("open", () => {
      trackSocket.open = true;
      for (const chunk of trackSocket.queue) {
        socket.send(chunk);
      }
      trackSocket.queue = [];
    });

    socket.on("message", (raw) => {
      let payload: unknown;
      try {
        payload = JSON.parse(raw.toString("utf8"));
      } catch {
        return;
      }
      const normalized = normalizeDeepgramTranscriptEvent({
        sessionId: session.sessionId,
        track,
        payload
      });
      if (!normalized) return;
      options.onTranscriptEvent(normalized);
    });

    socket.on("error", (error) => {
      options.onProviderError({
        sessionId: session.sessionId,
        message: error.message,
        track
      });
      logTranscriptionEvent({
        eventType: "TRANSCRIPTION_PROVIDER_ERROR",
        status: "ERROR",
        orgId: session.orgId,
        callLogId: session.callLogId,
        streamSessionId: session.streamSessionId,
        transcriptSessionId: session.sessionId,
        provider: "DEEPGRAM",
        reason: "socket_error",
        message: error.message,
        track
      });
    });

    socket.on("close", () => {
      trackSocket.closed = true;
    });
  }

  return {
    async startSession(input) {
      if (!env.DEEPGRAM_API_KEY) return;
      if (sessions.has(input.sessionId)) return;
      const session: RuntimeSession = {
        sessionId: input.sessionId,
        callLogId: input.callLogId,
        streamSessionId: input.streamSessionId,
        orgId: input.orgId,
        trackSockets: new Map()
      };
      sessions.set(input.sessionId, session);
      createTrackSocket(session, "inbound_track");
      createTrackSocket(session, "outbound_track");
    },
    async sendAudio(input) {
      const session = sessions.get(input.sessionId);
      if (!session) return;
      const trackSocket = session.trackSockets.get(input.track);
      if (!trackSocket || trackSocket.closed) return;
      if (trackSocket.open && trackSocket.socket.readyState === WebSocket.OPEN) {
        trackSocket.socket.send(input.audio);
        return;
      }
      trackSocket.queue.push(input.audio);
    },
    async finishSession(input) {
      const session = sessions.get(input.sessionId);
      if (!session) return;
      for (const trackSocket of session.trackSockets.values()) {
        closeTrackSocket(trackSocket);
      }
      sessions.delete(input.sessionId);
    }
  };
}
