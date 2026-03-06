import "dotenv/config";
import { prisma } from "../src/lib/prisma";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function printSection(title: string) {
  // eslint-disable-next-line no-console
  console.log(`\n${title}`);
}

function printRow(label: string, value: unknown) {
  const normalized =
    value === null || value === undefined || value === ""
      ? "-"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  // eslint-disable-next-line no-console
  console.log(`  ${label}: ${normalized}`);
}

async function run() {
  const callId = String(process.argv[2] || "").trim();
  if (!callId) {
    // eslint-disable-next-line no-console
    console.error("Usage: npm run verify:call -- <callId>");
    process.exitCode = 1;
    return;
  }

  const callLog = await prisma.callLog.findFirst({
    where: {
      OR: [{ id: callId }, { providerCallId: callId }]
    },
    select: {
      id: true,
      providerCallId: true,
      orgId: true,
      fromNumber: true,
      toNumber: true,
      startedAt: true,
      endedAt: true,
      appointmentRequested: true,
      outcome: true,
      leadId: true
    }
  });

  const effectiveCallId = callLog?.id || callId;
  const providerCallId = callLog?.providerCallId || callId;

  const [auditRows, inferredAuditRows, finalizeJob, appointments, messages, webhookEvents] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        action: "BOOKING_INTENT_SIGNALLED",
        metadataJson: { contains: providerCallId }
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        createdAt: true,
        metadataJson: true
      }
    }),
    prisma.auditLog.findMany({
      where: {
        action: "BOOKING_INTENT_INFERRED",
        metadataJson: { contains: providerCallId }
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        createdAt: true,
        metadataJson: true
      }
    }),
    prisma.finalizeBookingJob.findUnique({
      where: { callId: providerCallId },
      select: {
        callId: true,
        status: true,
        attemptCount: true,
        error: true,
        processedAt: true,
        updatedAt: true,
        smsSentAt: true,
        resultJson: true
      }
    }),
    prisma.appointment.findMany({
      where: {
        OR: [
          { callLogId: effectiveCallId },
          ...(callLog?.leadId ? [{ leadId: callLog.leadId }] : [])
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        customerName: true,
        customerPhone: true,
        startAt: true,
        endAt: true,
        calendarProvider: true,
        createdAt: true
      }
    }),
    prisma.message.findMany({
      where: {
        orgId: callLog?.orgId || undefined,
        ...(callLog?.fromNumber ? { OR: [{ toNumber: callLog.fromNumber }, { fromNumber: callLog.fromNumber }] } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        direction: true,
        status: true,
        body: true,
        createdAt: true,
        toNumber: true,
        fromNumber: true
      }
    }),
    prisma.vapiWebhookEvent.findMany({
      where: { callId: providerCallId },
      orderBy: { receivedAt: "desc" },
      take: 10,
      select: {
        messageType: true,
        receivedAt: true
      }
    })
  ]);

  // eslint-disable-next-line no-console
  console.log(`CALL ${effectiveCallId}`);

  printSection("SIGNAL");
  printRow("callLogId", callLog?.id);
  printRow("providerCallId", callLog?.providerCallId);
  printRow("orgId", callLog?.orgId);
  printRow("fromNumber", callLog?.fromNumber);
  printRow("toNumber", callLog?.toNumber);
  printRow("startedAt", formatDate(callLog?.startedAt));
  printRow("endedAt", formatDate(callLog?.endedAt));
  printRow("appointmentRequested", callLog?.appointmentRequested);
  printRow("outcome", callLog?.outcome);

  printSection("AUDIT");
  if (!auditRows.length) {
    printRow("BOOKING_INTENT_SIGNALLED", "not found");
  } else {
    for (const row of auditRows) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(row.metadataJson);
      } catch {
        parsed = { raw: row.metadataJson };
      }
      printRow("createdAt", formatDate(row.createdAt));
      printRow("confidence", parsed.confidence);
      printRow("requestedDatetime", parsed.requestedDatetime);
      printRow("reason", parsed.reason);
    }
  }
  if (!inferredAuditRows.length) {
    printRow("BOOKING_INTENT_INFERRED", "not found");
  } else {
    for (const row of inferredAuditRows) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(row.metadataJson);
      } catch {
        parsed = { raw: row.metadataJson };
      }
      printRow("inferredAt", formatDate(row.createdAt));
      printRow("source", parsed.source);
      printRow("confidence", parsed.confidence);
      printRow("reasons", parsed.reasons);
      printRow("ambiguities", parsed.ambiguities);
    }
  }

  printSection("WORKER");
  printRow("status", finalizeJob?.status);
  printRow("attempts", finalizeJob?.attemptCount);
  printRow("processedAt", formatDate(finalizeJob?.processedAt));
  printRow("updatedAt", formatDate(finalizeJob?.updatedAt));
  printRow("smsSentAt", formatDate(finalizeJob?.smsSentAt));
  printRow("error", finalizeJob?.error);
  printRow("resultJson", finalizeJob?.resultJson);

  printSection("WEBHOOKS");
  if (!webhookEvents.length) {
    printRow("events", "none");
  } else {
    printRow(
      "types",
      webhookEvents.map((row) => `${row.messageType}@${formatDate(row.receivedAt)}`).join(", ")
    );
  }

  printSection("BOOKING");
  if (!appointments.length) {
    printRow("appointments", "none");
  } else {
    for (const appointment of appointments) {
      printRow("appointmentId", appointment.id);
      printRow("status", appointment.status);
      printRow("customer", `${appointment.customerName} (${appointment.customerPhone})`);
      printRow("window", `${formatDate(appointment.startAt)} -> ${formatDate(appointment.endAt)}`);
      printRow("provider", appointment.calendarProvider);
      printRow("createdAt", formatDate(appointment.createdAt));
    }
  }

  printSection("MESSAGING");
  if (!messages.length) {
    printRow("messages", "none");
  } else {
    for (const message of messages) {
      printRow("messageId", message.id);
      printRow("direction", message.direction);
      printRow("status", message.status);
      printRow("to", message.toNumber);
      printRow("from", message.fromNumber);
      printRow("createdAt", formatDate(message.createdAt));
      printRow("body", message.body);
    }
  }
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`verify-call failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
