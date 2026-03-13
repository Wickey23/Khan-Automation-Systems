import { LeadSource, Prisma, type Lead, type CallLog } from "@prisma/client";
import { env } from "../../../config/env";
import { prisma } from "../../../lib/prisma";
import { syncServiceRequestForCall } from "../../automation/service-request.service";
import { classifyCallAndMaybeUpdateLead } from "../../org/call-classification.service";
import { createDeepgramStreamingAdapter } from "./deepgram-stream-client";
import {
  callTranscriptStatuses,
  transcriptionSessionStatuses,
  type NormalizedTranscriptEvent,
  type TranscriptTrack
} from "./transcription-adapter";
import { logTranscriptionEvent } from "./transcription-logger";

type BufferState = {
  text: string;
  confidence?: number;
  startTimeMs: number;
  endTimeMs: number;
  isFinal: boolean;
  providerSegmentId?: string;
};

type RuntimeTranscriptionSession = {
  transcriptSessionId: string;
  callLogId: string;
  providerCallId: string | null;
  orgId: string;
  streamSessionId: string;
  streamSid: string | null;
  ended: boolean;
  sequence: number;
  buffers: Map<TranscriptTrack, BufferState>;
};

type SummaryExtraction = {
  summary: string;
  customerName?: string | null;
  serviceRequested?: string | null;
  urgency?: string | null;
  serviceAddress?: string | null;
  appointmentRequested?: boolean;
  notes?: string | null;
};

const runtimeSessions = new Map<string, RuntimeTranscriptionSession>();
const runtimeByStreamSid = new Map<string, string>();
const finalizingCalls = new Set<string>();

const transcriptionAdapter = createDeepgramStreamingAdapter({
  onTranscriptEvent: (event) => {
    void handleNormalizedTranscriptEvent(event);
  },
  onProviderError: ({ sessionId, message }) => {
    void markTranscriptSessionError({ transcriptSessionId: sessionId, message });
  }
});

function isTerminalCall(call: Pick<CallLog, "endedAt" | "callStatus" | "dialCallStatus" | "outcome">) {
  if (call.endedAt) return true;
  const statuses = [call.callStatus, call.dialCallStatus].map((value) => String(value || "").toLowerCase());
  return statuses.some((value) => ["completed", "busy", "failed", "no-answer", "canceled"].includes(value));
}

function flushRequired(buffer: BufferState) {
  return buffer.isFinal || buffer.endTimeMs - buffer.startTimeMs >= 3000;
}

function mapTrackToSpeaker(track: TranscriptTrack) {
  if (track === "inbound_track") return "CALLER";
  if (track === "outbound_track") return "AGENT";
  return "UNKNOWN";
}

async function persistStableSegment(input: {
  runtime: RuntimeTranscriptionSession;
  track: TranscriptTrack;
  buffer: BufferState;
}) {
  const nextSequence = input.runtime.sequence + 1;
  input.runtime.sequence = nextSequence;
  await prisma.callTranscriptSegment.create({
    data: {
      transcriptSessionId: input.runtime.transcriptSessionId,
      callLogId: input.runtime.callLogId,
      orgId: input.runtime.orgId,
      streamSid: input.runtime.streamSid,
      speaker: mapTrackToSpeaker(input.track),
      text: input.buffer.text,
      confidence: input.buffer.confidence ?? null,
      startTimeMs: input.buffer.startTimeMs,
      endTimeMs: input.buffer.endTimeMs,
      sequence: nextSequence,
      isFinal: input.buffer.isFinal,
      providerSegmentId: input.buffer.providerSegmentId || null
    }
  });
  logTranscriptionEvent({
    eventType: "TRANSCRIPTION_SEGMENT_CREATED",
    status: "OK",
    orgId: input.runtime.orgId,
    callLogId: input.runtime.callLogId,
    streamSessionId: input.runtime.streamSessionId,
    transcriptSessionId: input.runtime.transcriptSessionId,
    providerCallId: input.runtime.providerCallId,
    streamSid: input.runtime.streamSid,
    sequence: nextSequence,
    speaker: mapTrackToSpeaker(input.track),
    isFinal: input.buffer.isFinal
  });
}

async function handleNormalizedTranscriptEvent(event: NormalizedTranscriptEvent) {
  const runtime = runtimeSessions.get(event.sessionId);
  if (!runtime || runtime.ended) return;

  const text = String(event.text || "").trim();
  if (!text) return;

  const candidate: BufferState = {
    text,
    confidence: event.confidence,
    startTimeMs: event.startTimeMs,
    endTimeMs: Math.max(event.endTimeMs, event.startTimeMs),
    isFinal: event.isFinal,
    providerSegmentId: event.providerSegmentId
  };

  if (flushRequired(candidate)) {
    await persistStableSegment({ runtime, track: event.track, buffer: candidate });
    runtime.buffers.delete(event.track);
  } else {
    runtime.buffers.set(event.track, candidate);
  }

  await prisma.callTranscriptSession.update({
    where: { id: runtime.transcriptSessionId },
    data: { sessionStatus: "ACTIVE" }
  });
}

async function flushBufferedSegments(runtime: RuntimeTranscriptionSession) {
  for (const [track, buffer] of runtime.buffers.entries()) {
    await persistStableSegment({
      runtime,
      track,
      buffer: { ...buffer, isFinal: buffer.isFinal }
    });
  }
  runtime.buffers.clear();
}

async function markTranscriptSessionError(input: { transcriptSessionId: string; message: string }) {
  const runtime = runtimeSessions.get(input.transcriptSessionId);
  if (!runtime) return;
  await prisma.callTranscriptSession.update({
    where: { id: input.transcriptSessionId },
    data: {
      sessionStatus: "ERROR",
      endedAt: new Date(),
      errorText: input.message
    }
  });
  runtime.ended = true;
  logTranscriptionEvent({
    eventType: "TRANSCRIPTION_PROVIDER_ERROR",
    status: "ERROR",
    orgId: runtime.orgId,
    callLogId: runtime.callLogId,
    streamSessionId: runtime.streamSessionId,
    transcriptSessionId: runtime.transcriptSessionId,
    providerCallId: runtime.providerCallId,
    streamSid: runtime.streamSid,
    message: input.message
  });
  void scheduleTranscriptFinalizeForCall(runtime.callLogId, "provider_error");
}

function inferServiceRequested(transcript: string) {
  const text = transcript.toLowerCase();
  if (
    text.includes("ac") ||
    text.includes("air conditioner") ||
    text.includes("hvac") ||
    text.includes("heating") ||
    text.includes("furnace") ||
    text.includes("cooling")
  ) {
    return "HVAC";
  }
  if (text.includes("plumb") || text.includes("pipe") || text.includes("water heater") || text.includes("drain") || text.includes("leak")) {
    return "Plumbing";
  }
  if (text.includes("electric") || text.includes("breaker") || text.includes("panel") || text.includes("outlet") || text.includes("wiring")) {
    return "Electrical";
  }
  if (text.includes("engine") || text.includes("transmission") || text.includes("truck") || text.includes("trailer") || text.includes("diesel")) {
    return "Truck repair";
  }
  if (text.includes("garage door")) return "Garage door";
  if (text.includes("appliance")) return "Appliance repair";
  return null;
}

function inferUrgency(transcript: string) {
  const text = transcript.toLowerCase();
  if (["emergency", "urgent", "asap", "immediately", "right now", "same day"].some((token) => text.includes(token))) {
    return "high";
  }
  if (["today", "soon", "as soon as possible", "stuck", "not working", "no heat", "no ac", "no power", "leaking"].some((token) => text.includes(token))) {
    return "medium";
  }
  return "normal";
}

function inferCustomerName(transcript: string) {
  const match = transcript.match(/my name is ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const name = match?.[1]?.trim() || null;
  if (!name) return null;
  const normalized = name.toLowerCase();
  if (["unknown", "caller", "customer", "contact"].includes(normalized)) return null;
  return name;
}

function inferServiceAddress(transcript: string) {
  const patterns = [
    /address is ([^\n.]+)/i,
    /located at ([^\n.]+)/i,
    /service address[:\s-]+([^\n.]+)/i,
    /come to ([0-9][^\n.]+)/i
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function inferAppointmentRequested(transcript: string) {
  const text = transcript.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return false;

  const hasExplicitAppointmentSignal = [
    /\bappointment\b/,
    /\bschedule\b/,
    /\bbook\b/,
    /\bset up an appointment\b/,
    /\bset up a visit\b/,
    /\bcan someone come out\b/,
    /\bwhen can you come\b/,
    /\bcome (today|tomorrow)\b/,
    /\b(this|next) week\b/,
    /\bsend someone\b/,
    /\bcan you come\b/,
    /\btechnician\b/,
    /\bservice call\b/,
  ].some((pattern) => pattern.test(text));

  const hasVisitContext = [
    /\brepair\b/,
    /\bfix\b/,
    /\bfurnace\b/,
    /\bac\b/,
    /\bair conditioner\b/,
    /\bheating\b/,
    /\bplumbing\b/,
    /\belectrical\b/,
    /\bunit\b/,
    /\bissue\b/,
    /\bproblem\b/,
  ].some((pattern) => pattern.test(text));

  const hasWeakInformationalOnlySignal =
    [/\bjust a question\b/, /\bquick question\b/, /\bhours\b/, /\bpricing\b/, /\bprice\b/, /\bquote\b/, /\bestimate\b/].some(
      (pattern) => pattern.test(text)
    ) && !hasVisitContext;

  if (hasWeakInformationalOnlySignal) return false;

  if (hasExplicitAppointmentSignal) return true;

  const hasTimeWindow = [/\btoday\b/, /\btomorrow\b/, /\bthis week\b/, /\bnext week\b/, /\bthis afternoon\b/, /\bthis morning\b/].some(
    (pattern) => pattern.test(text)
  );

  return hasTimeWindow && [/\bcome\b/, /\bsend someone\b/, /\bvisit\b/, /\btechnician\b/, /\brepair\b/, /\bfix\b/].some((pattern) =>
    pattern.test(text)
  );
}

function buildSafeCallSummaryFallback(input: {
  transcript?: string | null;
  outcome?: string | null;
  answeredAt?: Date | string | null;
}) {
  const transcriptText = String(input.transcript || "").trim();
  if (transcriptText) {
    return transcriptText.split("\n").slice(0, 3).join(" ").replace(/\s+/g, " ").trim().slice(0, 220) || "Call request captured for office review.";
  }

  const outcome = String(input.outcome || "").toUpperCase();
  if (outcome === "MISSED" || outcome === "ABANDONED") return "Caller still needs follow-up. Review the missed call and contact them back.";
  if (outcome === "SPAM") return "Call marked as spam.";
  if (outcome === "APPOINTMENT_REQUEST") return "Customer requested an appointment and should be reviewed by the office.";
  if (input.answeredAt) return "Call completed, but structured extraction was incomplete. Review the call record.";
  return "Call request captured for office review.";
}

function normalizeTranscriptLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function assembleFinalTranscript(
  segments: Array<{
    speaker: string;
    text: string;
  }>
) {
  const lines: string[] = [];
  let lastNormalizedLine = "";

  for (const segment of segments) {
    const normalizedText = normalizeTranscriptLine(segment.text);
    if (!normalizedText) continue;

    const line = `${segment.speaker}: ${normalizedText}`;
    const normalizedLine = normalizeTranscriptLine(line).toLowerCase();
    if (normalizedLine === lastNormalizedLine) continue;

    lines.push(line);
    lastNormalizedLine = normalizedLine;
  }

  return lines.join("\n");
}

async function generateSummary(input: {
  transcript: string;
  callLogId: string;
  orgId: string;
}): Promise<SummaryExtraction> {
  const fallback: SummaryExtraction = {
    summary: input.transcript.split("\n").slice(0, 4).join(" ").slice(0, 500) || "Call transcript captured.",
    customerName: inferCustomerName(input.transcript),
    serviceRequested: inferServiceRequested(input.transcript),
    urgency: inferUrgency(input.transcript),
    serviceAddress: inferServiceAddress(input.transcript),
    appointmentRequested: inferAppointmentRequested(input.transcript),
    notes: input.transcript.split("\n").slice(0, 6).join(" ").slice(0, 1000)
  };

  if (!env.OPENAI_API_KEY) return fallback;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.CALL_SUMMARY_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Summarize service-business call transcripts. Return JSON with keys: summary, customerName, serviceRequested, urgency, serviceAddress, appointmentRequested, notes. Normalize serviceRequested into short categories like HVAC, Plumbing, Electrical, Truck repair, Garage door, Appliance repair, General service. Set urgency to high, medium, or normal. Use null instead of guessing when a field is unclear."
          },
          {
            role: "user",
            content: input.transcript
          }
        ]
      })
    });
    if (!response.ok) return fallback;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = String(payload?.choices?.[0]?.message?.content || "").trim();
    if (!content) return fallback;
    const parsed = JSON.parse(content) as Partial<SummaryExtraction>;
    return {
      summary: String(parsed.summary || fallback.summary),
      customerName: parsed.customerName ? String(parsed.customerName) : fallback.customerName,
      serviceRequested: parsed.serviceRequested ? String(parsed.serviceRequested) : fallback.serviceRequested,
      urgency: parsed.urgency ? String(parsed.urgency) : fallback.urgency,
      serviceAddress: parsed.serviceAddress ? String(parsed.serviceAddress) : fallback.serviceAddress,
      appointmentRequested:
        typeof parsed.appointmentRequested === "boolean" ? parsed.appointmentRequested : fallback.appointmentRequested,
      notes: parsed.notes ? String(parsed.notes) : fallback.notes
    };
  } catch {
    return fallback;
  }
}

async function upsertLeadFromSummary(input: {
  call: Pick<CallLog, "id" | "orgId" | "fromNumber" | "leadId">;
  org: { name: string; industry: string | null };
  extraction: SummaryExtraction;
}) {
  const hasMeaningfulBusinessField = Boolean(
    input.extraction.serviceRequested || input.extraction.notes || input.extraction.customerName || input.extraction.serviceAddress
  );
  if (!input.call.fromNumber || !hasMeaningfulBusinessField) {
    logTranscriptionEvent({
      eventType: "LEAD_EXTRACTED",
      status: "WARN",
      orgId: input.call.orgId,
      callLogId: input.call.id,
      reason: "insufficient_signal_for_new_lead"
    });
    return null;
  }

  let lead: Lead | null = null;
  if (input.call.leadId) {
    lead = await prisma.lead.findFirst({ where: { id: input.call.leadId, orgId: input.call.orgId } });
  }
  if (!lead) {
    lead = await prisma.lead.findFirst({ where: { sourceCallLogId: input.call.id, orgId: input.call.orgId } });
  }

  const safeCustomerName =
    input.extraction.customerName && input.extraction.customerName.trim() && input.extraction.customerName.trim().toLowerCase() !== "unknown caller"
      ? input.extraction.customerName.trim()
      : null;
  const safeUrgency =
    input.extraction.urgency && ["high", "medium", "normal"].includes(String(input.extraction.urgency).toLowerCase())
      ? String(input.extraction.urgency).toLowerCase()
      : null;
  const safeServiceRequested = input.extraction.serviceRequested?.trim() || null;
  const safeServiceAddress = input.extraction.serviceAddress?.trim() || null;
  const safeSummary = input.extraction.summary?.trim() || null;
  const safeNotes = input.extraction.notes?.trim() || safeSummary;

  const payload = {
    name: safeCustomerName || lead?.name || "Unknown Caller",
    business: lead?.business || input.org.name,
    email: lead?.email || "",
    phone: input.call.fromNumber,
    industry: lead?.industry || input.org.industry || undefined,
    urgency: safeUrgency || lead?.urgency || undefined,
    notes: safeNotes || lead?.notes || undefined,
    serviceRequested: safeServiceRequested || lead?.serviceRequested || undefined,
    serviceAddress: safeServiceAddress || lead?.serviceAddress || undefined,
    appointmentRequested: input.extraction.appointmentRequested === true,
    sourceCallLogId: input.call.id,
    source: LeadSource.PHONE_CALL
  };

  const nextLead = lead
    ? await prisma.lead.update({
        where: { id: lead.id },
        data: payload
      })
    : await prisma.lead.create({
        data: {
          ...payload,
          orgId: input.call.orgId,
          message: safeSummary || "",
          preferredContact: "call"
        }
      });

  await prisma.callLog.update({
    where: { id: input.call.id },
    data: { leadId: nextLead.id, appointmentRequested: input.extraction.appointmentRequested === true }
  });

  logTranscriptionEvent({
    eventType: "LEAD_EXTRACTED",
    status: "OK",
    orgId: input.call.orgId,
    callLogId: input.call.id,
    message: lead ? "lead_updated" : "lead_created"
  });

  return nextLead;
}

export async function startTranscriptionForMediaStream(input: { streamSessionId: string }) {
  if (!env.DEEPGRAM_API_KEY || env.TRANSCRIPTION_PROVIDER !== "deepgram") return null;

  const streamSession = await prisma.callMediaStreamSession.findUnique({
    where: { id: input.streamSessionId },
    include: {
      callLog: {
        select: {
          id: true,
          orgId: true,
          providerCallId: true
        }
      },
      organization: {
        select: {
          id: true,
          businessSettings: {
            select: {
              voiceRoutingMode: true,
              voiceMediaStreamingEnabled: true,
              voiceTranscriptionEnabled: true
            }
          }
        }
      }
    }
  });

  if (!streamSession?.callLog) return null;

  const settings = streamSession.organization.businessSettings;
  const supportsTranscriptionRoutingMode =
    settings?.voiceRoutingMode === "PASSIVE_FORWARDING" ||
    settings?.voiceRoutingMode === "HUMAN_FIRST_AI_FALLBACK";

  if (
    !supportsTranscriptionRoutingMode ||
    settings.voiceMediaStreamingEnabled !== true ||
    settings.voiceTranscriptionEnabled !== true
  ) {
    return null;
  }

  let transcriptSession = await prisma.callTranscriptSession.findFirst({
    where: { streamSessionId: streamSession.id },
    orderBy: { createdAt: "desc" }
  });

  if (!transcriptSession) {
    transcriptSession = await prisma.callTranscriptSession.create({
      data: {
        callLogId: streamSession.callLogId,
        streamSessionId: streamSession.id,
        orgId: streamSession.orgId,
        provider: "deepgram",
        sessionStatus: transcriptionSessionStatuses[0],
        startedAt: new Date()
      }
    });
  }

  const existingSegments = await prisma.callTranscriptSegment.count({
    where: { transcriptSessionId: transcriptSession.id }
  });

  runtimeSessions.set(transcriptSession.id, {
    transcriptSessionId: transcriptSession.id,
    callLogId: streamSession.callLogId,
    providerCallId: streamSession.callLog.providerCallId,
    orgId: streamSession.orgId,
    streamSessionId: streamSession.id,
    streamSid: streamSession.streamSid,
    ended: false,
    sequence: existingSegments,
    buffers: new Map()
  });
  if (streamSession.streamSid) {
    runtimeByStreamSid.set(streamSession.streamSid, transcriptSession.id);
  }

  await prisma.callLog.update({
    where: { id: streamSession.callLogId },
    data: {
      transcriptStatus: callTranscriptStatuses[0]
    }
  });

  await transcriptionAdapter.startSession({
    sessionId: transcriptSession.id,
    callLogId: streamSession.callLogId,
    streamSessionId: streamSession.id,
    orgId: streamSession.orgId
  });

  logTranscriptionEvent({
    eventType: "TRANSCRIPTION_SESSION_STARTED",
    status: "OK",
    orgId: streamSession.orgId,
    callLogId: streamSession.callLogId,
    streamSessionId: streamSession.id,
    transcriptSessionId: transcriptSession.id,
    providerCallId: streamSession.callLog.providerCallId,
    streamSid: streamSession.streamSid
  });

  return transcriptSession;
}

export async function forwardMediaFrameToTranscription(input: {
  streamSid: string;
  track: "inbound_track" | "outbound_track";
  payloadBase64: string;
  sequenceNumber?: number | null;
  timestampMs?: number | null;
}) {
  const transcriptSessionId = runtimeByStreamSid.get(input.streamSid);
  if (!transcriptSessionId) return;
  const runtime = runtimeSessions.get(transcriptSessionId);
  if (!runtime || runtime.ended) return;
  const audio = Buffer.from(input.payloadBase64, "base64");
  await transcriptionAdapter.sendAudio({
    sessionId: transcriptSessionId,
    track: input.track,
    audio,
    sequenceNumber: input.sequenceNumber ?? undefined,
    timestampMs: input.timestampMs ?? undefined
  });
}

export function scheduleTranscriptFinalizeForCall(callLogId: string, reason: string) {
  setTimeout(() => {
    void finalizeTranscriptionForCall(callLogId, reason);
  }, 0);
}

export async function stopTranscriptionForStream(input: {
  streamSid: string;
  reason: string;
  errored?: boolean;
}) {
  const transcriptSessionId = runtimeByStreamSid.get(input.streamSid);
  if (!transcriptSessionId) return;
  const runtime = runtimeSessions.get(transcriptSessionId);
  if (!runtime || runtime.ended) return;

  runtime.ended = true;
  await flushBufferedSegments(runtime);
  await transcriptionAdapter.finishSession({ sessionId: transcriptSessionId });
  await prisma.callTranscriptSession.update({
    where: { id: transcriptSessionId },
    data: {
      sessionStatus: input.errored ? "ERROR" : "ENDED",
      endedAt: new Date(),
      ...(input.errored ? { errorText: input.reason } : {})
    }
  });

  logTranscriptionEvent({
    eventType: "TRANSCRIPTION_SESSION_ENDED",
    status: input.errored ? "ERROR" : "OK",
    orgId: runtime.orgId,
    callLogId: runtime.callLogId,
    streamSessionId: runtime.streamSessionId,
    transcriptSessionId: runtime.transcriptSessionId,
    providerCallId: runtime.providerCallId,
    streamSid: runtime.streamSid,
    reason: input.reason
  });

  runtimeSessions.delete(transcriptSessionId);
  runtimeByStreamSid.delete(input.streamSid);
  scheduleTranscriptFinalizeForCall(runtime.callLogId, input.reason);
}

export async function finalizeTranscriptionForCall(callLogId: string, reason: string) {
  if (finalizingCalls.has(callLogId)) return;
  finalizingCalls.add(callLogId);

  try {
    const call = await prisma.callLog.findUnique({
      where: { id: callLogId },
      include: {
        organization: { select: { name: true, industry: true } },
        transcriptSessions: {
          orderBy: { createdAt: "desc" },
          include: {
            segments: {
              orderBy: [{ sequence: "asc" }, { createdAt: "asc" }]
            }
          }
        }
      }
    });
    if (!call) return;

    const hasActiveRuntime = [...runtimeSessions.values()].some((session) => session.callLogId === callLogId && !session.ended);
    if (hasActiveRuntime) {
      logTranscriptionEvent({
        eventType: "TRANSCRIPTION_FINALIZE_SKIPPED",
        status: "WARN",
        orgId: call.orgId,
        callLogId: call.id,
        providerCallId: call.providerCallId,
        reason: "runtime_session_still_active"
      });
      return;
    }

    if (!isTerminalCall(call)) {
      logTranscriptionEvent({
        eventType: "TRANSCRIPTION_FINALIZE_SKIPPED",
        status: "WARN",
        orgId: call.orgId,
        callLogId: call.id,
        providerCallId: call.providerCallId,
        reason: "call_not_terminal"
      });
      return;
    }

    const segments = call.transcriptSessions
      .flatMap((session) => session.segments)
      .sort((left, right) => left.sequence - right.sequence || left.createdAt.getTime() - right.createdAt.getTime());

  const transcript = assembleFinalTranscript(segments);

    const updates: Prisma.CallLogUpdateInput = {};
    if (transcript.trim()) {
      updates.transcript = transcript;
      updates.transcriptStatus = "GENERATED";
      updates.transcriptGeneratedAt = new Date();
    } else if (call.transcriptStatus !== "ERROR") {
      updates.transcriptStatus = "ERROR";
    }

    let lead: Lead | null = null;
    if (transcript.trim() && !call.aiSummaryGeneratedAt) {
      const extraction = await generateSummary({
        transcript,
        callLogId: call.id,
        orgId: call.orgId
      });
      updates.aiSummary = extraction.summary || buildSafeCallSummaryFallback({
        transcript,
        outcome: call.outcome,
        answeredAt: call.answeredAt
      });
      updates.aiSummaryGeneratedAt = new Date();
      updates.appointmentRequested = extraction.appointmentRequested === true;
      lead = await upsertLeadFromSummary({
        call: call,
        org: call.organization,
        extraction
      });
      logTranscriptionEvent({
        eventType: "CALL_SUMMARY_GENERATED",
        status: "OK",
        orgId: call.orgId,
        callLogId: call.id,
        providerCallId: call.providerCallId
      });
    } else if (!call.aiSummaryGeneratedAt && !call.aiSummary) {
      updates.aiSummary = buildSafeCallSummaryFallback({
        transcript,
        outcome: call.outcome,
        answeredAt: call.answeredAt
      });
      updates.aiSummaryGeneratedAt = new Date();
    }

    if (Object.keys(updates).length) {
      await prisma.callLog.update({
        where: { id: call.id },
        data: updates
      });
    }

    if (lead || call.leadId) {
      await classifyCallAndMaybeUpdateLead({
        prisma,
        orgId: call.orgId,
        callLogId: call.id,
        leadId: lead?.id || call.leadId || null
      }).catch(() => null);
    }

    await syncServiceRequestForCall({
      callLogId: call.id,
      reason
    }).catch(() => null);

    logTranscriptionEvent({
      eventType: "TRANSCRIPTION_FINALIZE_COMPLETED",
      status: "OK",
      orgId: call.orgId,
      callLogId: call.id,
      providerCallId: call.providerCallId,
      reason
    });
  } catch (error) {
    const call = await prisma.callLog.findUnique({
      where: { id: callLogId },
      select: {
        id: true,
        orgId: true,
        providerCallId: true,
        outcome: true,
        answeredAt: true,
        transcript: true,
        aiSummary: true,
        aiSummaryGeneratedAt: true,
        transcriptStatus: true
      }
    });

    if (call) {
      const fallbackUpdates: Prisma.CallLogUpdateInput = {};
      if (!call.aiSummary) {
        fallbackUpdates.aiSummary = buildSafeCallSummaryFallback({
          transcript: call.transcript,
          outcome: call.outcome,
          answeredAt: call.answeredAt
        });
        fallbackUpdates.aiSummaryGeneratedAt = new Date();
      }
      if (!call.transcript && call.transcriptStatus !== "ERROR") {
        fallbackUpdates.transcriptStatus = "ERROR";
      }
      if (Object.keys(fallbackUpdates).length) {
        await prisma.callLog.update({
          where: { id: call.id },
          data: fallbackUpdates
        });
      }

      logTranscriptionEvent({
        eventType: "TRANSCRIPTION_FINALIZE_FAILED",
        status: "ERROR",
        orgId: call.orgId,
        callLogId: call.id,
        providerCallId: call.providerCallId,
        reason,
        message: error instanceof Error ? error.message : "unknown_error"
      });
    }
  } finally {
    finalizingCalls.delete(callLogId);
  }
}
