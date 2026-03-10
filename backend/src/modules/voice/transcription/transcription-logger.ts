type TranscriptionLogLevel = "OK" | "WARN" | "ERROR";

export function logTranscriptionEvent(payload: {
  eventType: string;
  status: TranscriptionLogLevel;
  orgId?: string | null;
  callLogId?: string | null;
  streamSessionId?: string | null;
  transcriptSessionId?: string | null;
  providerCallId?: string | null;
  streamSid?: string | null;
  provider?: string | null;
  reason?: string | null;
  message?: string | null;
  [key: string]: unknown;
}) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      orgId: payload.orgId || "-",
      provider: payload.provider || "DEEPGRAM",
      endpoint: "voice/transcription",
      eventType: payload.eventType,
      providerCallId: payload.providerCallId || "-",
      callLogId: payload.callLogId || null,
      streamSessionId: payload.streamSessionId || null,
      transcriptSessionId: payload.transcriptSessionId || null,
      streamSid: payload.streamSid || null,
      reason: payload.reason || null,
      message: payload.message || null,
      status: payload.status,
      ...Object.fromEntries(
        Object.entries(payload).filter(
          ([key]) =>
            ![
              "orgId",
              "provider",
              "eventType",
              "providerCallId",
              "callLogId",
              "streamSessionId",
              "transcriptSessionId",
              "streamSid",
              "reason",
              "message",
              "status"
            ].includes(key)
        )
      )
    })
  );
}
