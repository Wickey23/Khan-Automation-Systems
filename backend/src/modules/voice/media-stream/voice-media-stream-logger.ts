type MediaStreamLogLevel = "OK" | "WARN" | "ERROR";

export function logVoiceMediaStreamEvent(payload: {
  eventType: string;
  status: MediaStreamLogLevel;
  orgId?: string | null;
  callLogId?: string | null;
  providerCallId?: string | null;
  streamSid?: string | null;
  trackStrategy?: string | null;
  streamStatus?: string | null;
  endpoint?: string;
  requestId?: string | null;
  reason?: string | null;
  message?: string | null;
  [key: string]: unknown;
}) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      orgId: payload.orgId || "-",
      provider: "TWILIO",
      endpoint: payload.endpoint || "ws:/ws/twilio/voice-media",
      eventType: payload.eventType,
      requestId: payload.requestId || "-",
      providerCallId: payload.providerCallId || "-",
      streamSid: payload.streamSid || "-",
      trackStrategy: payload.trackStrategy || null,
      streamStatus: payload.streamStatus || null,
      reason: payload.reason || null,
      message: payload.message || null,
      status: payload.status,
      ...Object.fromEntries(
        Object.entries(payload).filter(
          ([key]) =>
            ![
              "orgId",
              "eventType",
              "requestId",
              "providerCallId",
              "streamSid",
              "trackStrategy",
              "streamStatus",
              "reason",
              "message",
              "status",
              "endpoint"
            ].includes(key)
        )
      )
    })
  );
}
