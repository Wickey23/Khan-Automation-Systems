type Source = "STRUCTURED" | "TOOL" | "TRANSCRIPT";

export type BookingToolArgs = {
  customerName?: string;
  customerPhone?: string;
  serviceAddress?: string;
  issueSummary?: string;
  requestedStartAt?: string;
  preferredTime?: string;
};

export type BookingEvaluationInput = {
  structured?: Record<string, unknown>;
  transcript: string;
  toolArgs?: BookingToolArgs | null;
};

export type BookingEvaluationResult = {
  bookingIntent: boolean;
  confidence: number;
  source: Source;
  extracted: {
    customerName?: string;
    customerPhone?: string;
    serviceAddress?: string;
    requestedStartAt?: Date;
    issueSummary?: string;
  };
  ambiguities: string[];
  reasons: string[];
};

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizePhone(input: string) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return String(input || "").trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractNameFromTranscript(text: string) {
  const source = String(text || "").trim();
  if (!source) return "";
  const patterns = [
    /\bmy name is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bthis is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bi(?:'m| am)\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,1})\b/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const raw = String(match?.[1] || "").trim();
    if (!raw) continue;
    return toTitleCase(raw.replace(/\s+/g, " "));
  }
  return "";
}

function extractAddressFromTranscript(text: string) {
  const source = String(text || "").trim();
  if (!source) return "";
  const patterns = [
    /\b(?:address is|at)\s+([0-9][^.!?\n]{8,120})/i,
    /\b(?:street address)\s+([0-9][^.!?\n]{8,120})/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const raw = String(match?.[1] || "")
      .replace(/\s+/g, " ")
      .trim();
    if (raw.length >= 10) return raw;
  }
  return "";
}

function extractRequestedStartAtFromTranscript(text: string) {
  const source = String(text || "");
  if (!source) return null;

  const iso = source.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:?\d{2})\b/i)?.[0];
  if (iso) return parseOptionalDate(iso);

  const slash = source.match(
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:at)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i
  );
  if (slash) return parseOptionalDate(`${slash[1]} ${slash[2]}`);

  const month = source.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?\s*(?:at)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i
  );
  if (month) return parseOptionalDate(`${month[0]}`);

  return null;
}

function detectTranscriptIntent(transcript: string) {
  const text = transcript.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const strongIntent = /\b(book an appointment|schedule an appointment|schedule service|need an appointment|can someone come out|send someone out)\b/;
  const weakIntent = /\b(book it|schedule it|set it up)\b/;

  if (strongIntent.test(text)) {
    score += 0.5;
    reasons.push("strong_intent_phrase");
  } else if (weakIntent.test(text)) {
    score += 0.35;
    reasons.push("weak_intent_phrase");
  }

  if (extractNameFromTranscript(transcript)) {
    score += 0.2;
    reasons.push("name_detected");
  }
  if (extractAddressFromTranscript(transcript)) {
    score += 0.2;
    reasons.push("address_like_detected");
  }
  if (extractRequestedStartAtFromTranscript(transcript)) {
    score += 0.1;
    reasons.push("datetime_detected");
  }

  return { score: Math.min(1, score), reasons };
}

function extractPhones(transcript: string) {
  const matches = transcript.match(/(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/g) || [];
  return [...new Set(matches.map((row) => normalizePhone(row)).filter(Boolean))];
}

function recursiveCollectToolCandidates(node: unknown, out: BookingToolArgs[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) recursiveCollectToolCandidates(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  const maybe = {
    customerName: pickString(obj.customerName),
    customerPhone: pickString(obj.customerPhone),
    serviceAddress: pickString(obj.serviceAddress),
    issueSummary: pickString(obj.issueSummary),
    requestedStartAt: pickString(obj.requestedStartAt),
    preferredTime: pickString(obj.preferredTime)
  };
  if (Object.values(maybe).some(Boolean)) out.push(maybe);
  for (const value of Object.values(obj)) recursiveCollectToolCandidates(value, out);
}

export function extractToolArgsFromPayload(payload: unknown) {
  const candidates: BookingToolArgs[] = [];
  recursiveCollectToolCandidates(payload, candidates);
  if (!candidates.length) return null;
  return candidates[candidates.length - 1] || null;
}

export function evaluateBookingRuleEngine(input: BookingEvaluationInput): BookingEvaluationResult {
  const transcript = String(input.transcript || "").trim();
  const structured = (input.structured || {}) as Record<string, unknown>;
  const toolArgs = input.toolArgs || null;
  const ambiguities: string[] = [];
  const reasons: string[] = [];

  const transcriptPhones = extractPhones(transcript);
  if (transcriptPhones.length > 1) ambiguities.push("MULTIPLE_PHONE_CANDIDATES");

  const source: Source = Boolean(structured.bookingIntent) || Boolean(structured.appointmentRequested)
    ? "STRUCTURED"
    : toolArgs
      ? "TOOL"
      : "TRANSCRIPT";

  const transcriptIntent = detectTranscriptIntent(transcript);
  let confidence = 0;
  let bookingIntent = false;

  if (source === "STRUCTURED") {
    confidence = 0.95;
    bookingIntent = true;
    reasons.push("structured_booking_intent");
  } else if (source === "TOOL") {
    confidence = 0.9;
    bookingIntent = true;
    reasons.push("tool_invoked");
  } else {
    confidence = transcriptIntent.score;
    bookingIntent = confidence >= 0.5;
    reasons.push(...transcriptIntent.reasons);
  }

  const structuredDate = parseOptionalDate(
    pickString(structured.requestedStartAt, structured.startAt, structured.preferredDateTime)
  );
  const toolDate = parseOptionalDate(pickString(toolArgs?.requestedStartAt, toolArgs?.preferredTime));
  const transcriptDate = extractRequestedStartAtFromTranscript(transcript);

  const extracted = {
    customerName: pickString(
      structured.customerName,
      structured.name,
      structured.fullName,
      toolArgs?.customerName,
      extractNameFromTranscript(transcript)
    ) || undefined,
    customerPhone: pickString(
      structured.customerPhone,
      structured.phone,
      toolArgs?.customerPhone,
      transcriptPhones[0]
    ) || undefined,
    serviceAddress: pickString(
      structured.serviceAddress,
      structured.address,
      toolArgs?.serviceAddress,
      extractAddressFromTranscript(transcript)
    ) || undefined,
    requestedStartAt: structuredDate || toolDate || transcriptDate || undefined,
    issueSummary: pickString(
      structured.issueSummary,
      structured.problem,
      structured.serviceIssue,
      toolArgs?.issueSummary
    ) || undefined
  };

  if (!extracted.customerName) ambiguities.push("MISSING_CUSTOMER_NAME");
  if (!extracted.customerPhone) ambiguities.push("MISSING_CUSTOMER_PHONE");

  return {
    bookingIntent,
    confidence,
    source,
    extracted,
    ambiguities,
    reasons
  };
}

