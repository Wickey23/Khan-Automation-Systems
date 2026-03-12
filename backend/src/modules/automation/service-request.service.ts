import type { CallLog, Lead, Prisma, ServiceRequest } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { logAutomationEvent } from "./automation-logger";
import { serviceRequestStatuses, terminalServiceRequestStatuses, type ServiceRequestStatus } from "./service-request-status";

type SyncServiceRequestInput = {
  callLogId: string;
  reason: string;
};

type CallForServiceRequest = Pick<
  CallLog,
  "id" | "orgId" | "fromNumber" | "providerCallId" | "leadId" | "appointmentRequested" | "aiSummary" | "transcript"
> & {
  organization: {
    name: string;
    businessSettings: {
      serviceRequestAutomationEnabled: boolean;
    } | null;
  };
  lead: Lead | null;
  serviceRequest: ServiceRequest | null;
};

function normalizeMeaningfulText(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (trimmed.length < 8) return null;
  if (trimmed === "Call transcript captured.") return null;
  return trimmed;
}

function buildThresholdSignals(input: {
  serviceType: string | null;
  urgency: string | null;
  appointmentRequested: boolean;
  serviceAddress: string | null;
  notes: string | null;
}) {
  const signals: string[] = [];
  if (input.serviceType) signals.push("serviceType");
  if (input.urgency) signals.push("urgency");
  if (input.appointmentRequested) signals.push("appointmentRequested");
  if (input.serviceAddress) signals.push("serviceAddress");
  if (input.notes) signals.push("notes");
  return signals;
}

function deriveNotes(input: { lead: Lead | null; aiSummary: string | null; transcript: string | null }) {
  const summary = normalizeMeaningfulText(input.aiSummary);
  if (summary) return summary;

  const leadNotes = normalizeMeaningfulText(input.lead?.notes);
  if (leadNotes) return leadNotes;

  const transcript = normalizeMeaningfulText(input.transcript);
  if (!transcript) return null;
  return transcript.split("\n").slice(0, 3).join(" ").slice(0, 1000);
}

function deriveStatus(input: {
  appointmentRequested: boolean;
  serviceType: string | null;
  urgency: string | null;
  serviceAddress: string | null;
  existingStatus?: string | null;
}): ServiceRequestStatus {
  if (input.existingStatus && terminalServiceRequestStatuses.has(input.existingStatus as ServiceRequestStatus)) {
    return input.existingStatus as ServiceRequestStatus;
  }
  if (input.appointmentRequested) return "NEEDS_SCHEDULING";
  if (input.serviceType || input.urgency || input.serviceAddress) return "NEW";
  return "NEEDS_REVIEW";
}

async function loadCall(callLogId: string): Promise<CallForServiceRequest | null> {
  const call = await prisma.callLog.findUnique({
    where: { id: callLogId },
    include: {
      organization: {
        select: {
          name: true,
          businessSettings: {
            select: {
              serviceRequestAutomationEnabled: true
            }
          }
        }
      },
      lead: true,
      serviceRequest: true
    }
  });

  return call as CallForServiceRequest | null;
}

export async function syncServiceRequestForCall(input: SyncServiceRequestInput) {
  const call = await loadCall(input.callLogId);
  if (!call) return null;

  if (call.organization.businessSettings?.serviceRequestAutomationEnabled !== true) {
    logAutomationEvent({
      eventType: "SERVICE_REQUEST_SKIPPED",
      status: "WARN",
      orgId: call.orgId,
      callLogId: call.id,
      leadId: call.leadId,
      providerCallId: call.providerCallId,
      reason: "automation_disabled"
    });
    return null;
  }

  const customerName = call.lead?.name?.trim() || null;
  const phone = call.lead?.phone?.trim() || call.fromNumber.trim();
  const serviceType = normalizeMeaningfulText(call.lead?.serviceRequested);
  const urgency = normalizeMeaningfulText(call.lead?.urgency);
  const serviceAddress = normalizeMeaningfulText(call.lead?.serviceAddress);
  const appointmentRequested = Boolean(call.lead?.appointmentRequested ?? call.appointmentRequested);
  const notes = deriveNotes({
    lead: call.lead,
    aiSummary: call.aiSummary,
    transcript: call.transcript
  });
  const thresholdSignals = buildThresholdSignals({
    serviceType,
    urgency,
    appointmentRequested,
    serviceAddress,
    notes
  });

  if (!phone || thresholdSignals.length === 0) {
    logAutomationEvent({
      eventType: "SERVICE_REQUEST_SKIPPED",
      status: "WARN",
      orgId: call.orgId,
      callLogId: call.id,
      leadId: call.leadId,
      providerCallId: call.providerCallId,
      reason: !phone ? "missing_phone" : "insufficient_signal",
      thresholdSignals
    });
    return null;
  }

  const status = deriveStatus({
    appointmentRequested,
    serviceType,
    urgency,
    serviceAddress,
    existingStatus: call.serviceRequest?.status || null
  });
  const timestamp = new Date();
  const automationMetadata = {
    version: 1,
    source: "PHASE4_FINALIZE",
    thresholdSignals,
    lastSyncReason: input.reason,
    lastSyncedAt: timestamp.toISOString()
  } satisfies Prisma.JsonObject;

  const payload = {
    orgId: call.orgId,
    callLogId: call.id,
    leadId: call.leadId || null,
    customerName,
    phone,
    serviceType,
    urgency,
    serviceAddress,
    appointmentRequested,
    status,
    notes,
    automationMetadataJson: automationMetadata
  };

  const serviceRequest = call.serviceRequest
    ? await prisma.serviceRequest.update({
        where: { id: call.serviceRequest.id },
        data: {
          leadId: payload.leadId,
          customerName: payload.customerName,
          phone: payload.phone,
          serviceType: payload.serviceType,
          urgency: payload.urgency,
          serviceAddress: payload.serviceAddress,
          appointmentRequested: payload.appointmentRequested,
          status: payload.status,
          notes: payload.notes,
          automationMetadataJson: automationMetadata
        }
      })
    : await prisma.serviceRequest.create({
      data: {
        ...payload,
        requestedAt: timestamp
        } satisfies Prisma.ServiceRequestUncheckedCreateInput
      });

  logAutomationEvent({
    eventType: call.serviceRequest ? "SERVICE_REQUEST_UPDATED" : "SERVICE_REQUEST_CREATED",
    status: "OK",
    orgId: call.orgId,
    callLogId: call.id,
    leadId: call.leadId,
    serviceRequestId: serviceRequest.id,
    providerCallId: call.providerCallId,
    thresholdSignals,
    serviceRequestStatus: serviceRequest.status
  });

  return serviceRequest;
}
