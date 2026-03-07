import crypto from "crypto";
import {
  AppointmentRequestActorType,
  AppointmentRequestEventType,
  AppointmentRequestStatus,
  Prisma,
  type AppointmentRequest,
  type PrismaClient
} from "@prisma/client";
import { env } from "../../config/env";
import { sendSmsMessage } from "../twilio/twilio.service";
import { getBusyBlocks } from "./calendar-busy.service";
import { createCalendarEventFromConnection } from "./calendar-oauth.service";
import { bookAppointmentWithHold } from "./booking.service";
import { generateAvailabilitySlots, validateSlotWithinBusinessHours } from "./slotting.service";

type RequestWithRelations = AppointmentRequest & {
  organization: { id: string; name: string };
  lead: { id: string; name: string | null; dnc: boolean } | null;
  callLog: { id: string; providerCallId: string | null } | null;
};

type OfferedSlot = {
  index: number;
  startAt: string;
  endAt: string;
  label: string;
  offeredAt: string;
  slotHash: string;
};

type OfferedSlotsPayload = {
  offerVersion: string;
  offeredAt: string;
  source: string;
  slots: OfferedSlot[];
  messageId?: string | null;
};

type ReplyParseResult =
  | { kind: "matched_slot"; slot: OfferedSlot }
  | { kind: "ambiguous" }
  | { kind: "invalid" }
  | { kind: "not_a_slot_reply" };

function normalizePhone(input: string | null | undefined) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function parseMetadataJson(input: string | null | undefined) {
  if (!input) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(input) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function hashSlot(input: { startAt: string; endAt: string }) {
  return crypto.createHash("sha256").update(`${input.startAt}|${input.endAt}`).digest("hex").slice(0, 16);
}

function randomOfferVersion() {
  return crypto.randomBytes(8).toString("hex");
}

function getEffectiveRequestSmsPhone(request: Pick<AppointmentRequest, "followUpPhone" | "callerPhone">) {
  return normalizePhone(request.followUpPhone || request.callerPhone);
}

function formatCustomerTime(input: { startAt: Date; timeZone: string }) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: input.timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(input.startAt);
}

function timeOfDayBucket(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function parseOfferedSlotsPayload(value: unknown): OfferedSlotsPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const offerVersion = typeof record.offerVersion === "string" && record.offerVersion.trim() ? record.offerVersion.trim() : "";
  const offeredAt = typeof record.offeredAt === "string" && record.offeredAt.trim() ? record.offeredAt.trim() : "";
  const source = typeof record.source === "string" && record.source.trim() ? record.source.trim() : "";
  const slotsValue = Array.isArray(record.slots) ? record.slots : [];
  const slots: OfferedSlot[] = [];
  for (const entry of slotsValue) {
    if (!entry || typeof entry !== "object") continue;
    const slot = entry as Record<string, unknown>;
    const index = Number(slot.index);
    const startAt = typeof slot.startAt === "string" ? slot.startAt : "";
    const endAt = typeof slot.endAt === "string" ? slot.endAt : "";
    const label = typeof slot.label === "string" ? slot.label : "";
    const offeredSlotAt = typeof slot.offeredAt === "string" ? slot.offeredAt : offeredAt;
    const slotHash = typeof slot.slotHash === "string" ? slot.slotHash : hashSlot({ startAt, endAt });
    if (!index || !startAt || !endAt || !label) continue;
    slots.push({ index, startAt, endAt, label, offeredAt: offeredSlotAt, slotHash });
  }
  if (!offerVersion || !offeredAt || !slots.length) return null;
  return {
    offerVersion,
    offeredAt,
    source: source || "appointment_request_sms",
    slots,
    messageId: typeof record.messageId === "string" ? record.messageId : null
  };
}

function buildOfferBody(slots: OfferedSlot[]) {
  const lines = slots.map((slot) => `${slot.index}) ${slot.label}`).join("\n");
  return `Thanks for calling! We have a few openings:\n\n${lines}\n\nReply with the number that works best.`;
}

function createOutboundMessageMetadata(input: {
  source: string;
  appointmentRequestId: string;
  offerVersion?: string | null;
  eventType?: string | null;
}) {
  return JSON.stringify({
    source: input.source,
    appointmentRequestId: input.appointmentRequestId,
    offerVersion: input.offerVersion || null,
    eventType: input.eventType || null
  });
}

async function loadRequestById(prisma: PrismaClient, orgId: string, requestId: string) {
  return prisma.appointmentRequest.findFirst({
    where: orgId ? { id: requestId, orgId } : { id: requestId },
    include: {
      organization: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, dnc: true } },
      callLog: { select: { id: true, providerCallId: true } }
    }
  }) as Promise<RequestWithRelations | null>;
}

async function getActiveTwilioNumber(prisma: PrismaClient, orgId: string) {
  return prisma.phoneNumber.findFirst({
    where: { orgId, provider: "TWILIO", status: "ACTIVE" },
    select: { e164Number: true }
  });
}

async function upsertSmsThread(input: {
  prisma: PrismaClient;
  orgId: string;
  toPhone: string;
  leadId?: string | null;
  contactName?: string | null;
}) {
  return input.prisma.messageThread.upsert({
    where: {
      orgId_channel_contactPhone: {
        orgId: input.orgId,
        channel: "SMS",
        contactPhone: input.toPhone
      }
    },
    update: {
      leadId: input.leadId || undefined,
      contactName: input.contactName || undefined,
      lastMessageAt: new Date()
    },
    create: {
      orgId: input.orgId,
      channel: "SMS",
      contactPhone: input.toPhone,
      leadId: input.leadId || null,
      contactName: input.contactName || null,
      lastMessageAt: new Date()
    }
  });
}

async function persistOutboundMessage(input: {
  prisma: PrismaClient;
  threadId: string;
  orgId: string;
  leadId?: string | null;
  fromNumber: string;
  toNumber: string;
  body: string;
  providerMessageId?: string | null;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  errorText?: string | null;
  metadataJson: string;
}) {
  return input.prisma.message.create({
    data: {
      threadId: input.threadId,
      orgId: input.orgId,
      leadId: input.leadId || null,
      direction: "OUTBOUND",
      status: input.status,
      body: input.body,
      provider: "TWILIO",
      providerMessageId: input.providerMessageId || null,
      fromNumber: input.fromNumber,
      toNumber: input.toNumber,
      sentAt: new Date(),
      errorText: input.errorText || null,
      metadataJson: input.metadataJson
    }
  });
}

async function sendCanonicalRequestSms(input: {
  prisma: PrismaClient;
  request: RequestWithRelations;
  body: string;
  metadataJson: string;
}) {
  const toNumber = getEffectiveRequestSmsPhone(input.request);
  if (!toNumber) return { ok: false as const, reason: "missing_effective_phone" };
  const activePhone = await getActiveTwilioNumber(input.prisma, input.request.orgId);
  if (!activePhone?.e164Number) return { ok: false as const, reason: "missing_sender" };
  const thread = await upsertSmsThread({
    prisma: input.prisma,
    orgId: input.request.orgId,
    toPhone: toNumber,
    leadId: input.request.leadId,
    contactName: input.request.customerName || input.request.lead?.name || null
  });

  const statusCallbackUrl = `${env.API_BASE_URL}/api/twilio/sms/status?orgId=${encodeURIComponent(input.request.orgId)}`;
  let providerMessageId: string | null = null;
  let status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" = "QUEUED";
  let errorText: string | null = null;

  try {
    const sent = await sendSmsMessage({
      from: activePhone.e164Number,
      to: toNumber,
      body: input.body,
      statusCallbackUrl
    });
    providerMessageId = sent.sid || null;
    const twStatus = String(sent.status || "").toLowerCase();
    if (twStatus === "delivered") status = "DELIVERED";
    else if (twStatus === "sent") status = "SENT";
    else if (["failed", "undelivered", "canceled"].includes(twStatus)) status = "FAILED";
    else status = "QUEUED";
    if (sent.errorCode || sent.errorMessage) {
      errorText = `Twilio ${sent.errorCode || ""} ${sent.errorMessage || ""}`.trim();
    }
  } catch (error) {
    status = "FAILED";
    errorText = error instanceof Error ? error.message : "sms_send_failed";
  }

  const message = await persistOutboundMessage({
    prisma: input.prisma,
    threadId: thread.id,
    orgId: input.request.orgId,
    leadId: input.request.leadId,
    fromNumber: activePhone.e164Number,
    toNumber,
    body: input.body,
    providerMessageId,
    status,
    errorText,
    metadataJson: input.metadataJson
  });

  return {
    ok: status !== "FAILED" as const,
    messageId: message.id,
    providerMessageId,
    toNumber,
    fromNumber: activePhone.e164Number,
    errorText,
    status
  };
}

async function createRequestEventAndTouch(input: {
  tx: Prisma.TransactionClient;
  requestId: string;
  orgId: string;
  type: AppointmentRequestEventType;
  actorType: AppointmentRequestActorType;
  actorId?: string | null;
  source?: string | null;
  fromStatus?: AppointmentRequestStatus | null;
  toStatus?: AppointmentRequestStatus | null;
  metadataJson?: Prisma.InputJsonValue;
}) {
  const now = new Date();
  await input.tx.appointmentRequestEvent.create({
    data: {
      appointmentRequestId: input.requestId,
      orgId: input.orgId,
      type: input.type,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      source: input.source ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      metadataJson: input.metadataJson ?? Prisma.JsonNull,
      createdAt: now
    }
  });
  await input.tx.appointmentRequest.update({
    where: { id: input.requestId },
    data: { lastEventAt: now }
  });
}

function buildOfferedSlotsPayload(input: {
  slots: Array<{ startAt: string; endAt: string; label: string }>;
  source: string;
}) {
  const offeredAt = new Date().toISOString();
  const offerVersion = randomOfferVersion();
  const slots: OfferedSlot[] = input.slots.slice(0, 3).map((slot, index) => ({
    index: index + 1,
    startAt: slot.startAt,
    endAt: slot.endAt,
    label: slot.label,
    offeredAt,
    slotHash: hashSlot({ startAt: slot.startAt, endAt: slot.endAt })
  }));
  return {
    offerVersion,
    offeredAt,
    source: input.source,
    slots
  } satisfies OfferedSlotsPayload;
}

export async function sendAppointmentRequestFollowUpSms(input: {
  prisma: PrismaClient;
  requestId: string;
  state: string;
}) {
  const request = await loadRequestById(input.prisma, "", input.requestId);
  if (!request) return { ok: false as const, reason: "request_not_found" };
  const businessName = request.organization.name || "Khan Systems";
  const safeName = request.customerName || request.lead?.name || "there";
  const address = String(request.serviceAddressRaw || "").trim();
  const body =
    input.state === "NEEDS_SCHEDULING"
      ? address
        ? `Thanks ${safeName} - ${businessName} received your service request at ${address}. Our team will contact you shortly to confirm scheduling.`
        : `Thanks ${safeName} - ${businessName} received your service request. Please reply with your full street address so we can finalize scheduling.`
      : `Thanks ${safeName} - ${businessName} received your service request. Our team will follow up shortly with scheduling options.`;

  return sendCanonicalRequestSms({
    prisma: input.prisma,
    request,
    body,
    metadataJson: createOutboundMessageMetadata({
      source: "appointment_request_follow_up",
      appointmentRequestId: request.id,
      eventType: "FOLLOW_UP"
    })
  });
}

export async function sendAppointmentRequestSlotOffer(input: {
  prisma: PrismaClient;
  orgId: string;
  requestId: string;
  source: string;
  actorType: AppointmentRequestActorType;
  actorId?: string | null;
  slots: Array<{ startAt: string; endAt: string; label: string }>;
}) {
  const request = await loadRequestById(input.prisma, input.orgId, input.requestId);
  if (!request) return { ok: false as const, reason: "request_not_found" };
  const offerPayload = buildOfferedSlotsPayload({ slots: input.slots, source: input.source });

  await input.prisma.$transaction(async (tx) => {
    await tx.appointmentRequest.update({
      where: { id: request.id },
      data: {
        status: AppointmentRequestStatus.SLOT_OFFERED,
        offeredSlotsJson: offerPayload as unknown as Prisma.InputJsonValue,
        lastEventAt: new Date()
      }
    });
    await createRequestEventAndTouch({
      tx,
      requestId: request.id,
      orgId: request.orgId,
      type: AppointmentRequestEventType.SLOTS_OFFERED,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      source: input.source,
      fromStatus: request.status,
      toStatus: AppointmentRequestStatus.SLOT_OFFERED,
      metadataJson: {
        offerVersion: offerPayload.offerVersion,
        offeredAt: offerPayload.offeredAt,
        slotCount: offerPayload.slots.length,
        slots: offerPayload.slots
      }
    });
  });

  const body = buildOfferBody(offerPayload.slots);
  const sendResult = await sendCanonicalRequestSms({
    prisma: input.prisma,
    request,
    body,
    metadataJson: createOutboundMessageMetadata({
      source: "appointment_request_slot_offer",
      appointmentRequestId: request.id,
      offerVersion: offerPayload.offerVersion,
      eventType: "SLOTS_OFFERED"
    })
  });

  if (!sendResult.ok) {
    console.error(
      JSON.stringify({
        event: "requestSmsOfferFailed",
        orgId: request.orgId,
        requestId: request.id,
        offerVersion: offerPayload.offerVersion,
        reason: sendResult.reason || sendResult.errorText || "send_failed"
      })
    );
    return { ok: false as const, reason: sendResult.reason || sendResult.errorText || "send_failed" };
  }

  await input.prisma.appointmentRequest.update({
    where: { id: request.id },
    data: {
      offeredSlotsJson: {
        ...(offerPayload as unknown as Prisma.InputJsonValue as object),
        messageId: sendResult.messageId
      } as Prisma.InputJsonValue
    }
  });

  console.info(
    JSON.stringify({
      event: "requestSmsOfferSent",
      orgId: request.orgId,
      requestId: request.id,
      offerVersion: offerPayload.offerVersion,
      to: sendResult.toNumber,
      from: sendResult.fromNumber,
      messageId: sendResult.messageId,
      providerMessageId: sendResult.providerMessageId
    })
  );

  return {
    ok: true as const,
    requestId: request.id,
    offerVersion: offerPayload.offerVersion,
    messageId: sendResult.messageId,
    providerMessageId: sendResult.providerMessageId
  };
}

function extractNumericChoice(text: string) {
  const match = text.match(/\b([1-9])\b/);
  return match ? Number(match[1]) : null;
}

function extractOrdinalChoice(text: string) {
  if (/\bfirst\b/.test(text)) return 1;
  if (/\bsecond\b/.test(text)) return 2;
  if (/\bthird\b/.test(text)) return 3;
  return null;
}

function resolveNaturalLanguageSlot(text: string, slots: OfferedSlot[]) {
  const normalized = text.toLowerCase();
  const matches = slots.filter((slot) => {
    const startAt = new Date(slot.startAt);
    if (Number.isNaN(startAt.getTime())) return false;
    const weekdayShort = startAt.toLocaleString("en-US", { weekday: "short" }).toLowerCase();
    const weekdayLong = startAt.toLocaleString("en-US", { weekday: "long" }).toLowerCase();
    const time = startAt.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
    const timeCompact = time.replace(/\s+/g, "");
    const bucket = timeOfDayBucket(startAt);
    const mentionsDay = normalized.includes(weekdayShort) || normalized.includes(weekdayLong);
    const mentionsTime = normalized.includes(time) || normalized.includes(timeCompact);
    const mentionsBucket = normalized.includes(bucket);
    return (mentionsDay && mentionsTime) || (mentionsDay && mentionsBucket);
  });
  if (matches.length === 1) return { kind: "matched_slot" as const, slot: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous" as const };
  return null;
}

export function parseSlotReply(input: { body: string; offeredSlots: OfferedSlot[] }): ReplyParseResult {
  const text = String(input.body || "").trim().toLowerCase();
  if (!text) return { kind: "not_a_slot_reply" };

  const numeric = extractNumericChoice(text) ?? extractOrdinalChoice(text);
  if (numeric !== null) {
    const matched = input.offeredSlots.find((slot) => slot.index === numeric);
    return matched ? { kind: "matched_slot", slot: matched } : { kind: "invalid" };
  }

  const natural = resolveNaturalLanguageSlot(text, input.offeredSlots);
  if (natural) return natural;

  if (/\b(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon|evening)\b/.test(text)) {
    return { kind: "ambiguous" };
  }

  return { kind: "not_a_slot_reply" };
}

async function listActionableRequestsForPhone(input: {
  prisma: PrismaClient;
  orgId: string;
  phone: string;
}) {
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) return [];
  return input.prisma.appointmentRequest.findMany({
    where: {
      orgId: input.orgId,
      status: AppointmentRequestStatus.SLOT_OFFERED,
      OR: [{ callerPhone: normalizedPhone }, { followUpPhone: normalizedPhone }]
    },
    include: {
      organization: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, dnc: true } },
      callLog: { select: { id: true, providerCallId: true } }
    },
    orderBy: { updatedAt: "desc" }
  }) as Promise<RequestWithRelations[]>;
}

async function resolveRequestByLatestOfferMessage(input: {
  prisma: PrismaClient;
  orgId: string;
  phone: string;
}) {
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) return null;
  const thread = await input.prisma.messageThread.findFirst({
    where: {
      orgId: input.orgId,
      channel: "SMS",
      contactPhone: normalizedPhone
    },
    select: { id: true }
  });
  if (!thread) return null;
  const outboundMessages = await input.prisma.message.findMany({
    where: {
      orgId: input.orgId,
      threadId: thread.id,
      direction: "OUTBOUND"
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      metadataJson: true,
      createdAt: true
    }
  });
  for (const message of outboundMessages) {
    const metadata = parseMetadataJson(message.metadataJson);
    if (metadata.source !== "appointment_request_slot_offer") continue;
    const requestId = typeof metadata.appointmentRequestId === "string" ? metadata.appointmentRequestId : "";
    const offerVersion = typeof metadata.offerVersion === "string" ? metadata.offerVersion : "";
    if (!requestId || !offerVersion) continue;
    const request = await loadRequestById(input.prisma, input.orgId, requestId);
    if (!request || request.status !== AppointmentRequestStatus.SLOT_OFFERED) continue;
    if (getEffectiveRequestSmsPhone(request) !== normalizedPhone) continue;
    const payload = parseOfferedSlotsPayload(request.offeredSlotsJson);
    if (!payload || payload.offerVersion !== offerVersion) continue;
    return { request, payload };
  }
  return null;
}

async function sendRequestReplySms(input: {
  prisma: PrismaClient;
  request: RequestWithRelations;
  body: string;
  source: string;
}) {
  return sendCanonicalRequestSms({
    prisma: input.prisma,
    request: input.request,
    body: input.body,
    metadataJson: createOutboundMessageMetadata({
      source: input.source,
      appointmentRequestId: input.request.id,
      eventType: "REPLY"
    })
  });
}

async function computeRefreshedSlots(input: {
  prisma: PrismaClient;
  request: RequestWithRelations;
}) {
  const settings = await input.prisma.businessSettings.findUnique({
    where: { orgId: input.request.orgId },
    select: {
      hoursJson: true,
      timezone: true,
      appointmentDurationMinutes: true,
      appointmentBufferMinutes: true,
      bookingLeadTimeHours: true,
      bookingMaxDaysAhead: true
    }
  });
  const now = new Date();
  const leadHours = settings?.bookingLeadTimeHours ?? 2;
  const from = new Date(now.getTime() + leadHours * 60 * 60 * 1000);
  const to = new Date(now.getTime() + (settings?.bookingMaxDaysAhead ?? 14) * 24 * 60 * 60 * 1000);
  const existingAppointments = await input.prisma.appointment.findMany({
    where: {
      orgId: input.request.orgId,
      status: { not: "CANCELED" },
      startAt: { lte: to },
      endAt: { gte: from }
    },
    select: { startAt: true, endAt: true, status: true },
    orderBy: { startAt: "asc" },
    take: 500
  });
  let externalBusyBlocks: Array<{ startAt: Date; endAt: Date }> = [];
  try {
    const busy = await getBusyBlocks({
      prisma: input.prisma,
      orgId: input.request.orgId,
      fromUtc: from,
      toUtc: to
    });
    externalBusyBlocks = busy.map((row) => ({ startAt: row.startUtc, endAt: row.endUtc }));
  } catch {
    externalBusyBlocks = [];
  }

  const slots = generateAvailabilitySlots({
    hoursJson: settings?.hoursJson || null,
    timezone: settings?.timezone || "America/New_York",
    appointmentDurationMinutes: settings?.appointmentDurationMinutes ?? 60,
    appointmentBufferMinutes: settings?.appointmentBufferMinutes ?? 15,
    bookingLeadTimeHours: settings?.bookingLeadTimeHours ?? 2,
    bookingMaxDaysAhead: settings?.bookingMaxDaysAhead ?? 14,
    from,
    to,
    existingAppointments,
    externalBusyBlocks
  });

  return slots.slice(0, 3).map((slot) => ({
    startAt: slot.startAt.toISOString(),
    endAt: slot.endAt.toISOString(),
    label: formatCustomerTime({
      startAt: slot.startAt,
      timeZone: settings?.timezone || "America/New_York"
    })
  }));
}

export async function handleAppointmentRequestSmsReply(input: {
  prisma: PrismaClient;
  orgId: string;
  fromNumber: string;
  toNumber: string;
  body: string;
}) {
  const normalizedPhone = normalizePhone(input.fromNumber);
  if (!normalizedPhone) return { handled: false as const };

  const directMatch = await resolveRequestByLatestOfferMessage({
    prisma: input.prisma,
    orgId: input.orgId,
    phone: normalizedPhone
  });

  let request = directMatch?.request || null;
  let offered = directMatch?.payload || null;

  if (!request || !offered) {
    const actionable = await listActionableRequestsForPhone({
      prisma: input.prisma,
      orgId: input.orgId,
      phone: normalizedPhone
    });
    if (actionable.length > 1) {
      console.error(
        JSON.stringify({
          event: "requestSmsReplyMultipleMatches",
          orgId: input.orgId,
          phone: normalizedPhone,
          requestIds: actionable.map((row) => row.id)
        })
      );
      const first = actionable[0];
      if (first) {
        await sendRequestReplySms({
          prisma: input.prisma,
          request: first,
          body: "We found more than one open scheduling request for this number. A team member will follow up shortly to help.",
          source: "appointment_request_reply_multiple_matches"
        });
      }
      return { handled: true as const, outcome: "multiple_matches" as const };
    }
    if (actionable.length !== 1) return { handled: false as const };
    request = actionable[0];
    offered = parseOfferedSlotsPayload(request.offeredSlotsJson);
    if (!offered) return { handled: false as const };
  }

  console.info(
    JSON.stringify({
      event: "requestSmsReplyReceived",
      orgId: input.orgId,
      requestId: request.id,
      phone: normalizedPhone
    })
  );

  const parseResult = parseSlotReply({
    body: input.body,
    offeredSlots: offered.slots
  });

  if (parseResult.kind === "not_a_slot_reply") return { handled: false as const };

  if (parseResult.kind === "ambiguous") {
    await sendRequestReplySms({
      prisma: input.prisma,
      request,
      body: "I’m not sure which option you want. Reply with 1, 2, or 3.",
      source: "appointment_request_reply_ambiguous"
    });
    console.error(JSON.stringify({ event: "requestSmsReplyAmbiguous", orgId: input.orgId, requestId: request.id }));
    return { handled: true as const, outcome: "ambiguous" as const };
  }

  if (parseResult.kind === "invalid") {
    await sendRequestReplySms({
      prisma: input.prisma,
      request,
      body: "Please reply with 1, 2, or 3 to choose one of the available times.",
      source: "appointment_request_reply_invalid"
    });
    console.error(JSON.stringify({ event: "requestSmsReplyInvalid", orgId: input.orgId, requestId: request.id }));
    return { handled: true as const, outcome: "invalid" as const };
  }

  const selected = parseResult.slot;
  const startAt = new Date(selected.startAt);
  const endAt = new Date(selected.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    await sendRequestReplySms({
      prisma: input.prisma,
      request,
      body: "That option is no longer available. A team member will follow up shortly with updated options.",
      source: "appointment_request_reply_stale"
    });
    console.error(JSON.stringify({ event: "requestSmsReplySlotStale", orgId: input.orgId, requestId: request.id, reason: "invalid_slot_dates" }));
    return { handled: true as const, outcome: "stale" as const };
  }

  if (request.status === AppointmentRequestStatus.SCHEDULED || request.appointmentId) {
    await sendRequestReplySms({
      prisma: input.prisma,
      request,
      body: "Your appointment is already scheduled. A team member will follow up if anything else is needed.",
      source: "appointment_request_reply_already_scheduled"
    });
    console.info(JSON.stringify({ event: "requestSmsReplyAlreadyScheduled", orgId: input.orgId, requestId: request.id }));
    return { handled: true as const, outcome: "already_scheduled" as const };
  }

  const settings = await input.prisma.businessSettings.findUnique({
    where: { orgId: input.orgId },
    select: {
      hoursJson: true,
      timezone: true,
      appointmentBufferMinutes: true
    }
  });
  const durationMinutes = Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / (60 * 1000)));
  const inHours = validateSlotWithinBusinessHours({
    hoursJson: settings?.hoursJson || null,
    timezone: settings?.timezone || "America/New_York",
    slotStartAt: startAt,
    appointmentDurationMinutes: durationMinutes
  });
  if (!inHours.ok) {
    const refreshed = await computeRefreshedSlots({ prisma: input.prisma, request });
    if (refreshed.length) {
      await sendAppointmentRequestSlotOffer({
        prisma: input.prisma,
        orgId: input.orgId,
        requestId: request.id,
        source: "appointment_request_reply_stale_reoffer",
        actorType: AppointmentRequestActorType.SYSTEM,
        actorId: "twilio-sms",
        slots: refreshed
      });
    } else {
      await sendRequestReplySms({
        prisma: input.prisma,
        request,
        body: "That time is no longer available. A team member will follow up shortly with updated options.",
        source: "appointment_request_reply_stale"
      });
    }
    console.error(JSON.stringify({ event: "requestSmsReplySlotStale", orgId: input.orgId, requestId: request.id, reason: "outside_hours" }));
    return { handled: true as const, outcome: "stale" as const };
  }

  const booking = await bookAppointmentWithHold({
    prisma: input.prisma,
    orgId: input.orgId,
    userId: "twilio-sms",
    appointmentRequestId: request.id,
    leadId: request.leadId,
    callLogId: request.callLogId,
    customerName: request.customerName || request.lead?.name || "Customer",
    customerPhone: getEffectiveRequestSmsPhone(request),
    issueSummary: request.issueSummary || "Service request",
    serviceAddress: request.serviceAddressRaw || null,
    startAt,
    endAt,
    timezone: settings?.timezone || "America/New_York",
    appointmentBufferMinutes: settings?.appointmentBufferMinutes ?? 15,
    requestedProvider: "INTERNAL",
    businessHoursValidation: {
      hoursJson: settings?.hoursJson || null,
      timezone: settings?.timezone || "America/New_York"
    }
  });

  if (!booking.ok) {
    const refreshed = await computeRefreshedSlots({ prisma: input.prisma, request });
    if (refreshed.length) {
      await sendAppointmentRequestSlotOffer({
        prisma: input.prisma,
        orgId: input.orgId,
        requestId: request.id,
        source: "appointment_request_reply_stale_reoffer",
        actorType: AppointmentRequestActorType.SYSTEM,
        actorId: "twilio-sms",
        slots: refreshed
      });
    } else {
      await sendRequestReplySms({
        prisma: input.prisma,
        request,
        body: "That time is no longer available. A team member will follow up shortly with updated options.",
        source: "appointment_request_reply_stale"
      });
    }
    console.error(
      JSON.stringify({
        event: "requestSmsReplySlotStale",
        orgId: input.orgId,
        requestId: request.id,
        reason: booking.reason
      })
    );
    return { handled: true as const, outcome: "stale" as const };
  }

  console.info(
    JSON.stringify({
      event: "requestSmsReplyBooked",
      orgId: input.orgId,
      requestId: request.id,
      appointmentId: booking.appointment.id
    })
  );
  return { handled: true as const, outcome: "booked" as const, appointmentId: booking.appointment.id };
}
