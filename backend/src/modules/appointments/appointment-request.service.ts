import {
  AppointmentRequestActorType,
  AppointmentRequestEventType,
  AppointmentRequestSource,
  AppointmentRequestStatus,
  type AppointmentRequest,
  Prisma,
  type PrismaClient
} from "@prisma/client";

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function safeParseJsonObject(input: string | null | undefined) {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normalizePhoneE164(input: string | null | undefined) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function normalizePreferenceLabel(input: string | null | undefined) {
  const value = String(input || "").trim();
  if (!value) return null;
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferRequestedTimeLabel(input: { requestedStartAt?: string | null; requestedPreference?: string | null; aiSummary?: string | null; transcript?: string | null }) {
  const preferred = normalizePreferenceLabel(input.requestedPreference);
  if (preferred) return preferred;

  const requestedStartAt = String(input.requestedStartAt || "").trim();
  if (requestedStartAt) {
    const parsed = new Date(requestedStartAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    }
  }

  const text = `${String(input.aiSummary || "")} ${String(input.transcript || "")}`.toLowerCase();
  if (!text.trim()) return null;

  const explicitDatePatterns = [
    /\b(?:for|on)?\s*((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening))?(?:\s+around\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/,
    /\b(?:for|on)?\s*((?:tomorrow|next week(?:end)?|this weekend)(?:\s+(?:morning|afternoon|evening))?(?:\s+around\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/,
    /\b(?:for|on)?\s*((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?)\b/,
    /\b(?:for|on)?\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?)\b/
  ];

  for (const pattern of explicitDatePatterns) {
    const match = text.match(pattern);
    const value = String(match?.[1] || "").trim();
    if (!value) continue;
    return normalizePreferenceLabel(value);
  }

  const relativePatterns = [
    /\b(tomorrow morning|tomorrow afternoon|tomorrow evening|tomorrow)\b/,
    /\b(next week(?:end)?|this weekend)\b/,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(morning|afternoon|evening))?\b/
  ];

  for (const pattern of relativePatterns) {
    const match = text.match(pattern);
    if (match?.[0]) return normalizePreferenceLabel(match[0]);
  }

  return null;
}

const STATUS_PRECEDENCE: Record<AppointmentRequestStatus, number> = {
  PENDING_REVIEW: 1,
  APPROVED: 2,
  SLOT_OFFERED: 3,
  SCHEDULED: 4,
  DENIED: 5,
  CLOSED: 6
};

function chooseWorkerStatus(existing: AppointmentRequestStatus | null, desired: AppointmentRequestStatus) {
  if (!existing) return desired;
  if (existing === AppointmentRequestStatus.DENIED || existing === AppointmentRequestStatus.CLOSED) return existing;
  return STATUS_PRECEDENCE[existing] > STATUS_PRECEDENCE[desired] ? existing : desired;
}

function mapWorkerStateToRequestStatus(state: string, hasAppointment: boolean) {
  if (state === "CONFIRMED" && hasAppointment) return AppointmentRequestStatus.SCHEDULED;
  return AppointmentRequestStatus.PENDING_REVIEW;
}

async function createRequestEventTx(
  tx: Prisma.TransactionClient,
  input: {
    appointmentRequestId: string;
    orgId: string;
    type: AppointmentRequestEventType;
    fromStatus?: AppointmentRequestStatus | null;
    toStatus?: AppointmentRequestStatus | null;
    actorType: AppointmentRequestActorType;
    actorId?: string | null;
    source?: string | null;
    metadataJson?: Prisma.InputJsonValue;
  }
) {
  const now = new Date();
  await tx.appointmentRequestEvent.create({
    data: {
      appointmentRequestId: input.appointmentRequestId,
      orgId: input.orgId,
      type: input.type,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      source: input.source ?? null,
      metadataJson: input.metadataJson ?? Prisma.JsonNull,
      createdAt: now
    }
  });
  await tx.appointmentRequest.update({
    where: { id: input.appointmentRequestId },
    data: { lastEventAt: now }
  });
}

function mapReviewAuditToStatus(audits: Array<{ action: string; metadataJson: string; createdAt: Date; actorUserId: string }>) {
  let status: AppointmentRequestStatus = AppointmentRequestStatus.PENDING_REVIEW;
  let assignedUserId: string | null = null;
  let reviewedAt: Date | null = null;
  let reviewedByUserId: string | null = null;

  for (const audit of audits) {
    const metadata = safeParseJsonObject(audit.metadataJson);
    const explicitAssignedUserId = String(metadata?.assignedUserId || "").trim();
    if (audit.action === "APPOINTMENT_REQUEST_ASSIGNED" && explicitAssignedUserId) assignedUserId = explicitAssignedUserId;
    if (audit.action === "APPOINTMENT_REQUEST_APPROVED") {
      status = AppointmentRequestStatus.APPROVED;
      reviewedAt = audit.createdAt;
      reviewedByUserId = audit.actorUserId || null;
    }
    if (audit.action === "APPOINTMENT_REQUEST_DENIED") {
      status = AppointmentRequestStatus.DENIED;
      reviewedAt = audit.createdAt;
      reviewedByUserId = audit.actorUserId || null;
    }
  }

  return { status, assignedUserId, reviewedAt, reviewedByUserId };
}

export async function backfillAppointmentRequestsForOrg(prisma: PrismaClient, orgId: string) {
  const callLogs = await prisma.callLog.findMany({
    where: {
      orgId,
      OR: [{ appointmentRequested: true }, { outcome: "APPOINTMENT_REQUEST" }, { appointments: { some: {} } }]
    },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          serviceAddress: true,
          serviceRequested: true,
          pipelineStage: true
        }
      },
      appointments: {
        select: { id: true, startAt: true, endAt: true, assignedTechnician: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { startedAt: "desc" },
    take: 500
  });

  if (!callLogs.length) return { scanned: 0, created: 0, updated: 0, skipped: 0 };

  const providerCallIds = callLogs.map((row) => row.providerCallId).filter((value): value is string => Boolean(value));
  const callLogIds = callLogs.map((row) => row.id);

  const [jobs, audits, existingRequests] = await Promise.all([
    prisma.finalizeBookingJob.findMany({
      where: {
        OR: [
          { callId: { in: callLogIds } },
          ...(providerCallIds.length ? [{ callId: { in: providerCallIds } }] : [])
        ]
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.auditLog.findMany({
      where: {
        orgId,
        action: { in: ["APPOINTMENT_REQUEST_APPROVED", "APPOINTMENT_REQUEST_DENIED", "APPOINTMENT_REQUEST_ASSIGNED"] }
      },
      orderBy: { createdAt: "asc" },
      take: 2_000
    }),
    prisma.appointmentRequest.findMany({
      where: { orgId, callLogId: { in: callLogIds } },
      select: { id: true, callLogId: true, source: true, sourceVersion: true, backfilledAt: true, lastEventAt: true }
    })
  ]);

  const jobByCallKey = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) {
    if (!jobByCallKey.has(job.callId)) jobByCallKey.set(job.callId, job);
  }

  const auditsByCallLogId = new Map<string, typeof audits>();
  for (const audit of audits) {
    const metadata = safeParseJsonObject(audit.metadataJson);
    const requestCallLogId = String(metadata?.requestCallLogId || "").trim();
    if (!requestCallLogId) continue;
    const current = auditsByCallLogId.get(requestCallLogId) || [];
    current.push(audit);
    auditsByCallLogId.set(requestCallLogId, current);
  }

  const existingByCallLogId = new Map(existingRequests.map((row) => [row.callLogId, row]));
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const callLog of callLogs) {
    const existing = existingByCallLogId.get(callLog.id);
    const finalizeJob = jobByCallKey.get(callLog.providerCallId || "") || jobByCallKey.get(callLog.id) || null;
    const resultObj =
      finalizeJob?.resultJson && typeof finalizeJob.resultJson === "object"
        ? (finalizeJob.resultJson as Record<string, unknown>)
        : null;
    const auditsForCall = auditsByCallLogId.get(callLog.id) || [];
    const review = mapReviewAuditToStatus(auditsForCall);
    const appointment = callLog.appointments[0] || null;
    const state = String(resultObj?.state || "").trim();
    const requestedStartAt = pickString(resultObj?.requestedStartAt);
    const requestedPreference = pickString(resultObj?.requestedPreference);

    let status: AppointmentRequestStatus = review.status;
    if (appointment) status = AppointmentRequestStatus.SCHEDULED;
    else if (state === "AVAILABILITY_SHARED" && finalizeJob?.smsSentAt) status = AppointmentRequestStatus.SLOT_OFFERED;
    else if (status === AppointmentRequestStatus.PENDING_REVIEW && state === "PROPOSED") status = AppointmentRequestStatus.APPROVED;

    const createData: Prisma.AppointmentRequestUncheckedCreateInput = {
      orgId,
      callLogId: callLog.id,
      leadId: callLog.leadId || null,
      appointmentId: appointment?.id || null,
      status,
      source: AppointmentRequestSource.BACKFILLED,
      sourceVersion: "appointment-request-backfill-v1",
      backfilledAt: new Date(),
      callerPhone: normalizePhoneE164(callLog.fromNumber),
      customerName:
        pickString(resultObj?.customerName) && pickString(resultObj?.customerName).toLowerCase() !== "unknown caller"
          ? pickString(resultObj?.customerName)
          : callLog.lead?.name || null,
      issueSummary: pickString(resultObj?.issueSummary, callLog.lead?.serviceRequested, callLog.aiSummary, callLog.transcript).slice(0, 500) || null,
      serviceAddressRaw: pickString(resultObj?.serviceAddress, callLog.lead?.serviceAddress) || null,
      requestedStartAt: requestedStartAt ? new Date(requestedStartAt) : null,
      requestedPreference: requestedPreference || inferRequestedTimeLabel({
        requestedStartAt,
        requestedPreference,
        aiSummary: callLog.aiSummary,
        transcript: callLog.transcript
      }),
      assignedUserId: review.assignedUserId || null,
      reviewedByUserId: review.reviewedByUserId || null,
      reviewedAt: review.reviewedAt,
      scheduledAt: appointment?.startAt || null,
      lastEventAt: review.reviewedAt || finalizeJob?.updatedAt || callLog.updatedAt
    };

    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const createdRow = await tx.appointmentRequest.create({ data: createData });
        await createRequestEventTx(tx, {
          appointmentRequestId: createdRow.id,
          orgId,
          type: AppointmentRequestEventType.BACKFILLED,
          actorType: AppointmentRequestActorType.BACKFILL,
          source: "appointment-request-backfill-v1",
          fromStatus: null,
          toStatus: createdRow.status,
          metadataJson: {
            callLogId: callLog.id,
            providerCallId: callLog.providerCallId,
            finalizeJobId: finalizeJob?.id || null
          }
        });
      });
      created += 1;
      continue;
    }

    const updateData: Prisma.AppointmentRequestUncheckedUpdateInput = {};
    if (!existing.sourceVersion) updateData.sourceVersion = "appointment-request-backfill-v1";
    if ((!existing.source || existing.source === AppointmentRequestSource.BACKFILLED) && !existing.backfilledAt) {
      updateData.backfilledAt = new Date();
    }
    if (createData.leadId) updateData.leadId = createData.leadId;
    if (createData.appointmentId) updateData.appointmentId = createData.appointmentId;
    if (createData.customerName) updateData.customerName = createData.customerName;
    if (createData.issueSummary) updateData.issueSummary = createData.issueSummary;
    if (createData.serviceAddressRaw) updateData.serviceAddressRaw = createData.serviceAddressRaw;
    if (createData.requestedStartAt) updateData.requestedStartAt = createData.requestedStartAt;
    if (createData.requestedPreference) updateData.requestedPreference = createData.requestedPreference;
    if (review.assignedUserId) updateData.assignedUserId = review.assignedUserId;
    if (review.reviewedByUserId) updateData.reviewedByUserId = review.reviewedByUserId;
    if (review.reviewedAt) updateData.reviewedAt = review.reviewedAt;
    const nextLastEventAt = createData.lastEventAt instanceof Date ? createData.lastEventAt : null;
    if (nextLastEventAt && nextLastEventAt > existing.lastEventAt) updateData.lastEventAt = nextLastEventAt;
    if (Object.keys(updateData).length === 0) {
      skipped += 1;
      continue;
    }
    await prisma.appointmentRequest.update({ where: { id: existing.id }, data: updateData });
    updated += 1;
  }

  return { scanned: callLogs.length, created, updated, skipped };
}

function shouldCreateRequestFromWorkerState(state: string) {
  return ["NEEDS_SCHEDULING", "PROPOSED", "CONFIRMED"].includes(state);
}

export async function upsertAppointmentRequestFromWorkerResult(input: {
  prisma: PrismaClient;
  callId: string;
  result: Record<string, unknown>;
}) {
  const state = String(input.result.state || "").trim();
  if (!shouldCreateRequestFromWorkerState(state)) return null;

  const callLog = await input.prisma.callLog.findFirst({
    where: {
      OR: [{ id: input.callId }, { providerCallId: input.callId }]
    },
    orderBy: { createdAt: "desc" }
  });
  if (!callLog?.orgId) return null;

  const desiredStatus = mapWorkerStateToRequestStatus(state, Boolean(input.result.appointmentId));
  const customerName = pickString(input.result.customerName);
  const issueSummary = pickString(input.result.issueSummary).slice(0, 500);
  const requestedStartAt = pickString(input.result.requestedStartAt);
  const requestedPreference = pickString(input.result.requestedPreference);
  const serviceAddress = pickString(input.result.serviceAddress);

  const existing = await input.prisma.appointmentRequest.findUnique({
    where: { callLogId: callLog.id }
  });

  const nextStatus = chooseWorkerStatus(existing?.status || null, desiredStatus);
  const normalizedCallerPhone = normalizePhoneE164(pickString(input.result.customerPhone, callLog.fromNumber));

  const createData: Prisma.AppointmentRequestUncheckedCreateInput = {
    orgId: callLog.orgId,
    callLogId: callLog.id,
    leadId: pickString(input.result.leadId, callLog.leadId) || null,
    appointmentId: pickString(input.result.appointmentId) || null,
    status: nextStatus,
    source: AppointmentRequestSource.WORKER,
    sourceVersion: String(input.result.decisionVersion || "worker-v1"),
    callerPhone: normalizedCallerPhone,
    customerName: customerName || null,
    issueSummary: issueSummary || null,
    serviceAddressRaw: serviceAddress || null,
    requestedStartAt: requestedStartAt ? new Date(requestedStartAt) : null,
    requestedPreference: requestedPreference || null,
    scheduledAt: nextStatus === AppointmentRequestStatus.SCHEDULED && requestedStartAt ? new Date(requestedStartAt) : null,
    lastEventAt: new Date()
  };

  if (!existing) {
    await input.prisma.$transaction(async (tx) => {
      const created = await tx.appointmentRequest.create({ data: createData });
      await createRequestEventTx(tx, {
        appointmentRequestId: created.id,
        orgId: created.orgId,
        type: AppointmentRequestEventType.CREATED,
        actorType: AppointmentRequestActorType.WORKER,
        actorId: "postcall-worker",
        source: "worker",
        fromStatus: null,
        toStatus: created.status,
        metadataJson: {
          callId: input.callId,
          providerCallId: callLog.providerCallId,
          workerState: state
        }
      });
    });
    return true;
  }

  const updateData: Prisma.AppointmentRequestUncheckedUpdateInput = {};
  if (createData.leadId) updateData.leadId = createData.leadId;
  if (createData.appointmentId) updateData.appointmentId = createData.appointmentId;
  if (normalizedCallerPhone) updateData.callerPhone = normalizedCallerPhone;
  if (customerName) updateData.customerName = customerName;
  if (issueSummary) updateData.issueSummary = issueSummary;
  if (serviceAddress) updateData.serviceAddressRaw = serviceAddress;
  if (requestedStartAt) updateData.requestedStartAt = new Date(requestedStartAt);
  if (requestedPreference) updateData.requestedPreference = requestedPreference;
  if (nextStatus !== existing.status) {
    updateData.status = nextStatus;
    if (nextStatus === AppointmentRequestStatus.SCHEDULED) {
      updateData.scheduledAt = requestedStartAt ? new Date(requestedStartAt) : new Date();
    }
  }

  const hasChanges = Object.keys(updateData).length > 0;
  if (!hasChanges) return false;

  await input.prisma.$transaction(async (tx) => {
    await tx.appointmentRequest.update({ where: { id: existing.id }, data: { ...updateData, lastEventAt: new Date() } });
    if (nextStatus !== existing.status) {
      await createRequestEventTx(tx, {
        appointmentRequestId: existing.id,
        orgId: callLog.orgId,
        type: nextStatus === AppointmentRequestStatus.SCHEDULED ? AppointmentRequestEventType.APPOINTMENT_CREATED : AppointmentRequestEventType.MANUAL_OVERRIDE,
        actorType: AppointmentRequestActorType.WORKER,
        actorId: "postcall-worker",
        source: "worker",
        fromStatus: existing.status,
        toStatus: nextStatus,
        metadataJson: {
          callId: input.callId,
          workerState: state
        }
      });
    }
  });
  return true;
}

export async function listAppointmentRequestsForOrg(prisma: PrismaClient, orgId: string) {
  const requests = await prisma.appointmentRequest.findMany({
    where: {
      orgId,
      status: { in: [AppointmentRequestStatus.PENDING_REVIEW, AppointmentRequestStatus.APPROVED, AppointmentRequestStatus.DENIED, AppointmentRequestStatus.SLOT_OFFERED] }
    },
    include: {
      callLog: {
        select: {
          id: true,
          providerCallId: true,
          startedAt: true,
          aiSummary: true,
          transcript: true
        }
      },
      lead: {
        select: {
          id: true,
          pipelineStage: true
        }
      },
      assignedUser: { select: { id: true, email: true } },
      reviewedByUser: { select: { id: true, email: true } }
    },
    orderBy: [{ lastEventAt: "desc" }, { createdAt: "desc" }]
  });

  return requests.map((request) => ({
    id: request.id,
    callLogId: request.callLogId,
    providerCallId: request.callLog.providerCallId,
    leadId: request.leadId,
    appointmentId: request.appointmentId,
    customerName: request.customerName || "Unknown Caller",
    customerPhone: request.callerPhone,
    callerPhone: request.callerPhone,
    followUpPhone: request.followUpPhone,
    effectiveSmsPhone: request.followUpPhone || request.callerPhone,
    issueSummary: request.issueSummary || "Service request captured by voice assistant.",
    serviceAddress: request.serviceAddressRaw || null,
    startedAt: request.callLog.startedAt.toISOString(),
    createdAt: request.createdAt.toISOString(),
    lastEventAt: request.lastEventAt.toISOString(),
    requestedStartAt: request.requestedStartAt ? request.requestedStartAt.toISOString() : null,
    requestedTimeLabel: inferRequestedTimeLabel({
      requestedStartAt: request.requestedStartAt ? request.requestedStartAt.toISOString() : null,
      requestedPreference: request.requestedPreference,
      aiSummary: request.callLog.aiSummary,
      transcript: request.callLog.transcript
    }),
    requestedPreference: normalizePreferenceLabel(request.requestedPreference),
    requestState: request.status,
    status: request.status,
    source: request.source,
    assignedUserId: request.assignedUserId,
    assignedUserLabel: request.assignedUser?.email || null,
    reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
    reviewedByUserId: request.reviewedByUserId,
    reviewedByLabel: request.reviewedByUser?.email || null,
    denialReason: request.denialReason,
    pipelineStage: request.lead?.pipelineStage || null
  }));
}

export async function getAppointmentRequestForOrg(prisma: PrismaClient, orgId: string, requestId: string) {
  const requests = await listAppointmentRequestsForOrg(prisma, orgId);
  return requests.find((request) => request.id === requestId) || null;
}

async function updateLeadPipelineForRequest(tx: Prisma.TransactionClient, request: AppointmentRequest, status: AppointmentRequestStatus) {
  if (!request.leadId) return;
  if (status === AppointmentRequestStatus.SCHEDULED) {
    await tx.lead.updateMany({
      where: { id: request.leadId, orgId: request.orgId },
      data: { pipelineStage: "SCHEDULED" }
    });
    return;
  }
  if (status === AppointmentRequestStatus.DENIED || status === AppointmentRequestStatus.CLOSED) {
    await tx.lead.updateMany({
      where: { id: request.leadId, orgId: request.orgId },
      data: { pipelineStage: "COMPLETED", status: "LOST" }
    });
    return;
  }
  await tx.lead.updateMany({
    where: { id: request.leadId, orgId: request.orgId },
    data: { pipelineStage: "NEEDS_SCHEDULING" }
  });
}

export async function approveAppointmentRequest(input: { prisma: PrismaClient; orgId: string; requestId: string; actorUserId: string; actorRole: string; assignedUserId?: string | null }) {
  return input.prisma.$transaction(async (tx) => {
    const request = await tx.appointmentRequest.findFirst({
      where: { id: input.requestId, orgId: input.orgId }
    });
    if (!request) throw new Error("Appointment request not found.");

    const nextStatus = request.status === AppointmentRequestStatus.SCHEDULED ? request.status : AppointmentRequestStatus.APPROVED;
    await tx.appointmentRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(),
        ...(input.assignedUserId ? { assignedUserId: input.assignedUserId } : {}),
        lastEventAt: new Date()
      }
    });
    await createRequestEventTx(tx, {
      appointmentRequestId: request.id,
      orgId: request.orgId,
      type: AppointmentRequestEventType.APPROVED,
      actorType: AppointmentRequestActorType.USER,
      actorId: input.actorUserId,
      source: input.actorRole,
      fromStatus: request.status,
      toStatus: nextStatus,
      metadataJson: { assignedUserId: input.assignedUserId || null }
    });
    await updateLeadPipelineForRequest(tx, request, nextStatus);
    return true;
  });
}

export async function denyAppointmentRequest(input: { prisma: PrismaClient; orgId: string; requestId: string; actorUserId: string; actorRole: string; denialReason?: string | null }) {
  return input.prisma.$transaction(async (tx) => {
    const request = await tx.appointmentRequest.findFirst({
      where: { id: input.requestId, orgId: input.orgId }
    });
    if (!request) throw new Error("Appointment request not found.");
    await tx.appointmentRequest.update({
      where: { id: request.id },
      data: {
        status: AppointmentRequestStatus.DENIED,
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(),
        denialReason: input.denialReason || null,
        lastEventAt: new Date()
      }
    });
    await createRequestEventTx(tx, {
      appointmentRequestId: request.id,
      orgId: request.orgId,
      type: AppointmentRequestEventType.DENIED,
      actorType: AppointmentRequestActorType.USER,
      actorId: input.actorUserId,
      source: input.actorRole,
      fromStatus: request.status,
      toStatus: AppointmentRequestStatus.DENIED,
      metadataJson: { denialReason: input.denialReason || null }
    });
    await updateLeadPipelineForRequest(tx, request, AppointmentRequestStatus.DENIED);
    return true;
  });
}

export async function assignAppointmentRequest(input: { prisma: PrismaClient; orgId: string; requestId: string; actorUserId: string; actorRole: string; assignedUserId: string }) {
  return input.prisma.$transaction(async (tx) => {
    const request = await tx.appointmentRequest.findFirst({
      where: { id: input.requestId, orgId: input.orgId }
    });
    if (!request) throw new Error("Appointment request not found.");
    await tx.appointmentRequest.update({
      where: { id: request.id },
      data: {
        assignedUserId: input.assignedUserId,
        lastEventAt: new Date()
      }
    });
    await createRequestEventTx(tx, {
      appointmentRequestId: request.id,
      orgId: request.orgId,
      type: AppointmentRequestEventType.ASSIGNED,
      actorType: AppointmentRequestActorType.USER,
      actorId: input.actorUserId,
      source: input.actorRole,
      fromStatus: request.status,
      toStatus: request.status,
      metadataJson: { assignedUserId: input.assignedUserId }
    });
    return true;
  });
}

export async function updateAppointmentRequestFollowUpPhone(input: { prisma: PrismaClient; orgId: string; requestId: string; actorUserId: string; actorRole: string; followUpPhone: string | null }) {
  const normalized = input.followUpPhone ? normalizePhoneE164(input.followUpPhone) : null;
  return input.prisma.$transaction(async (tx) => {
    const request = await tx.appointmentRequest.findFirst({
      where: { id: input.requestId, orgId: input.orgId }
    });
    if (!request) throw new Error("Appointment request not found.");
    await tx.appointmentRequest.update({
      where: { id: request.id },
      data: { followUpPhone: normalized, lastEventAt: new Date() }
    });
    await createRequestEventTx(tx, {
      appointmentRequestId: request.id,
      orgId: request.orgId,
      type: AppointmentRequestEventType.FOLLOW_UP_PHONE_UPDATED,
      actorType: AppointmentRequestActorType.USER,
      actorId: input.actorUserId,
      source: input.actorRole,
      fromStatus: request.status,
      toStatus: request.status,
      metadataJson: { followUpPhone: normalized }
    });
    return true;
  });
}

export async function markAppointmentRequestSlotsOffered(input: {
  prisma: PrismaClient;
  orgId: string;
  requestId: string;
  actorType: AppointmentRequestActorType;
  actorId?: string | null;
  source?: string | null;
  slots: Array<{ startAt: string; endAt: string }>;
}) {
  return input.prisma.$transaction(async (tx) => {
    const request = await tx.appointmentRequest.findFirst({
      where: { id: input.requestId, orgId: input.orgId }
    });
    if (!request) throw new Error("Appointment request not found.");
    await tx.appointmentRequest.update({
      where: { id: request.id },
      data: {
        status: AppointmentRequestStatus.SLOT_OFFERED,
        offeredSlotsJson: input.slots as unknown as Prisma.InputJsonValue,
        lastEventAt: new Date()
      }
    });
    await createRequestEventTx(tx, {
      appointmentRequestId: request.id,
      orgId: request.orgId,
      type: AppointmentRequestEventType.SLOTS_OFFERED,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      source: input.source ?? null,
      fromStatus: request.status,
      toStatus: AppointmentRequestStatus.SLOT_OFFERED,
      metadataJson: { slots: input.slots }
    });
    return true;
  });
}

export async function markAppointmentRequestScheduled(input: {
  prisma: PrismaClient;
  orgId: string;
  requestId?: string | null;
  callLogId?: string | null;
  appointmentId: string;
  actorUserId: string;
  actorRole: string;
  startAt: Date;
  endAt: Date;
}) {
  return input.prisma.$transaction(async (tx) => {
    const request = input.requestId
      ? await tx.appointmentRequest.findFirst({ where: { id: input.requestId, orgId: input.orgId } })
      : input.callLogId
        ? await tx.appointmentRequest.findFirst({ where: { callLogId: input.callLogId, orgId: input.orgId } })
        : null;
    if (!request) return false;

    await tx.appointmentRequest.update({
      where: { id: request.id },
      data: {
        appointmentId: input.appointmentId,
        status: AppointmentRequestStatus.SCHEDULED,
        scheduledAt: input.startAt,
        selectedSlotStartAt: input.startAt,
        selectedSlotEndAt: input.endAt,
        reviewedByUserId: request.reviewedByUserId || input.actorUserId,
        reviewedAt: request.reviewedAt || new Date(),
        lastEventAt: new Date()
      }
    });
    await createRequestEventTx(tx, {
      appointmentRequestId: request.id,
      orgId: request.orgId,
      type: AppointmentRequestEventType.APPOINTMENT_CREATED,
      actorType: AppointmentRequestActorType.USER,
      actorId: input.actorUserId,
      source: input.actorRole,
      fromStatus: request.status,
      toStatus: AppointmentRequestStatus.SCHEDULED,
      metadataJson: { appointmentId: input.appointmentId }
    });
    await updateLeadPipelineForRequest(tx, request, AppointmentRequestStatus.SCHEDULED);
    return true;
  });
}
