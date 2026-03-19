import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export type OutreachMetadata = {
  leadId: string | null;
  enrollmentId: string | null;
  callerConfigId: string | null;
  orgId: string | null;
};

export function extractOutreachMetadata(records: Array<Record<string, unknown>>): OutreachMetadata | null {
  for (const candidate of records) {
    const source = pickString(candidate.source);
    const leadId = pickString(candidate.outreachLeadId);
    const enrollmentId = pickString(candidate.outreachPhoneEnrollmentId);
    const callerConfigId = pickString(candidate.outreachCallerConfigId);
    const orgId = pickString(candidate.orgId || candidate.organizationId);
    if (source === "admin-outreach" || leadId || enrollmentId || callerConfigId || orgId) {
      return {
        leadId: leadId || null,
        enrollmentId: enrollmentId || null,
        callerConfigId: callerConfigId || null,
        orgId: orgId || null
      };
    }
  }
  return null;
}

export type SyncOutreachPhoneEventInput = {
  orgId: string;
  providerCallId: string;
  eventType: string;
  callStatus: string;
  outcome: string | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  toPhone: string;
  fromPhone: string | null;
  outreach: { leadId: string | null; enrollmentId: string | null; callerConfigId: string | null };
};

export async function syncOutreachPhoneEventFromVapi(input: SyncOutreachPhoneEventInput) {
  const normalizedCallStatus = String(input.callStatus || "").toLowerCase();
  const terminalStatuses = new Set(["ended", "completed", "failed", "canceled", "cancelled", "busy", "no-answer", "timeout"]);
  const failureStatuses = new Set(["failed", "busy", "no-answer", "timeout", "canceled", "cancelled"]);
  const isTerminal = input.eventType === "end-of-call-report" || terminalStatuses.has(normalizedCallStatus);
  const finalEventType = failureStatuses.has(normalizedCallStatus) ? "FAILED" : "COMPLETED";

  const metadata = {
    transcript: input.transcript,
    recordingUrl: input.recordingUrl,
    outcome: input.outcome,
    callStatus: normalizedCallStatus || null
  } as Prisma.InputJsonValue;

  await prisma.outreachPhoneEvent.updateMany({
    where: {
      providerCallId: input.providerCallId,
      eventType: "STARTED"
    },
    data: {
      status: normalizedCallStatus || null,
      summary: input.summary || undefined,
      metadata
    }
  });

  if (!isTerminal) return;

  const existingTerminal = await prisma.outreachPhoneEvent.findFirst({
    where: {
      providerCallId: input.providerCallId,
      eventType: finalEventType
    },
    select: { id: true }
  });

  if (!existingTerminal) {
    await prisma.outreachPhoneEvent.create({
      data: {
        orgId: input.orgId,
        leadId: input.outreach.leadId,
        enrollmentId: input.outreach.enrollmentId,
        callerConfigId: input.outreach.callerConfigId,
        provider: "VAPI",
        providerCallId: input.providerCallId,
        eventType: finalEventType as any,
        toPhone: input.toPhone,
        fromPhone: input.fromPhone,
        status: normalizedCallStatus || null,
        summary: input.summary || null,
        errorMessage:
          finalEventType === "FAILED"
            ? input.summary || input.outcome || normalizedCallStatus || "Outreach call failed."
            : null,
        metadata
      }
    });
  }

  if (input.outreach.enrollmentId) {
    await prisma.outreachPhoneEnrollment.updateMany({
      where: { id: input.outreach.enrollmentId },
      data: {
        status: finalEventType === "FAILED" ? "FAILED" : "COMPLETED",
        nextCallAt: null,
        processingStartedAt: null,
        stopReason:
          finalEventType === "FAILED"
            ? input.summary || input.outcome || normalizedCallStatus || "Outreach call failed."
            : null
      }
    });
  }
}
