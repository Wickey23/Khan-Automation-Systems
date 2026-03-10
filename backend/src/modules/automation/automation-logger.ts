type AutomationLogLevel = "OK" | "WARN" | "ERROR";

export function logAutomationEvent(payload: {
  eventType: string;
  status: AutomationLogLevel;
  orgId?: string | null;
  callLogId?: string | null;
  leadId?: string | null;
  serviceRequestId?: string | null;
  providerCallId?: string | null;
  reason?: string | null;
  message?: string | null;
  [key: string]: unknown;
}) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      orgId: payload.orgId || "-",
      provider: "SYSTEM",
      endpoint: "automation/service-request",
      eventType: payload.eventType,
      providerCallId: payload.providerCallId || "-",
      callLogId: payload.callLogId || null,
      leadId: payload.leadId || null,
      serviceRequestId: payload.serviceRequestId || null,
      reason: payload.reason || null,
      message: payload.message || null,
      status: payload.status,
      ...Object.fromEntries(
        Object.entries(payload).filter(
          ([key]) =>
            ![
              "orgId",
              "eventType",
              "providerCallId",
              "callLogId",
              "leadId",
              "serviceRequestId",
              "reason",
              "message",
              "status"
            ].includes(key)
        )
      )
    })
  );
}
