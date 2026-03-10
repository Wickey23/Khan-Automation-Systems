import { z } from "zod";

const stringNumber = z.union([z.string(), z.number()]).optional();

const customParametersSchema = z
  .union([
    z.record(z.string(), z.string()),
    z.array(z.object({ name: z.string(), value: z.string() }))
  ])
  .optional();

export const twilioMediaConnectedSchema = z.object({
  event: z.literal("connected"),
  protocol: z.string().optional(),
  version: z.string().optional(),
  streamSid: z.string().optional()
});

export const twilioMediaStartSchema = z.object({
  event: z.literal("start"),
  sequenceNumber: stringNumber,
  streamSid: z.string().optional(),
  start: z.object({
    accountSid: z.string().optional(),
    streamSid: z.string().optional(),
    callSid: z.string(),
    tracks: z.union([z.array(z.string()), z.string()]).optional(),
    customParameters: customParametersSchema,
    mediaFormat: z
      .object({
        encoding: z.string().optional(),
        sampleRate: z.union([z.string(), z.number()]).optional(),
        channels: z.union([z.string(), z.number()]).optional()
      })
      .passthrough()
      .optional()
  })
});

export const twilioMediaPayloadSchema = z.object({
  event: z.literal("media"),
  sequenceNumber: stringNumber,
  streamSid: z.string(),
  media: z.object({
    track: z.string(),
    chunk: stringNumber,
    timestamp: stringNumber,
    payload: z.string()
  })
});

export const twilioDtmfPayloadSchema = z.object({
  event: z.literal("dtmf"),
  sequenceNumber: stringNumber,
  streamSid: z.string().optional(),
  dtmf: z
    .object({
      digit: z.string().optional(),
      track: z.string().optional()
    })
    .passthrough()
});

export const twilioMediaStopSchema = z.object({
  event: z.literal("stop"),
  sequenceNumber: stringNumber,
  streamSid: z.string().optional(),
  stop: z
    .object({
      accountSid: z.string().optional(),
      callSid: z.string().optional(),
      reason: z.string().optional()
    })
    .passthrough()
});

export const twilioKnownMediaEnvelopeSchema = z.discriminatedUnion("event", [
  twilioMediaConnectedSchema,
  twilioMediaStartSchema,
  twilioMediaPayloadSchema,
  twilioDtmfPayloadSchema,
  twilioMediaStopSchema
]);

export const twilioMediaEnvelopeSchema = twilioKnownMediaEnvelopeSchema.or(z.object({ event: z.string() }).passthrough());

export const twilioMediaStatusCallbackSchema = z.object({
  AccountSid: z.string().optional(),
  CallSid: z.string(),
  StreamSid: z.string(),
  StreamName: z.string().optional(),
  StreamEvent: z.enum(["stream-started", "stream-stopped", "stream-error"]),
  StreamError: z.string().optional(),
  Timestamp: z.string().optional()
});

export function normalizeCustomParameters(value: unknown) {
  if (!value) return {} as Record<string, string>;
  if (Array.isArray(value)) {
    return value.reduce<Record<string, string>>((acc, item) => {
      if (
        item &&
        typeof item === "object" &&
        "name" in item &&
        "value" in item &&
        typeof (item as { name?: unknown }).name === "string" &&
        typeof (item as { value?: unknown }).value === "string"
      ) {
        acc[(item as { name: string }).name] = (item as { value: string }).value;
      }
      return acc;
    }, {});
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => [k, String(v)])
    );
  }
  return {} as Record<string, string>;
}

export function parseOptionalSequenceNumber(value: string | number | undefined) {
  if (value === undefined) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}
