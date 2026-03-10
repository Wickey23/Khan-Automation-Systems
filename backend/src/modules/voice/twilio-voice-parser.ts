import { z } from "zod";

export const twilioInboundVoiceSchema = z.object({
  CallSid: z.string().min(1),
  AccountSid: z.string().optional(),
  ParentCallSid: z.string().optional(),
  From: z.string().optional(),
  To: z.string().optional(),
  CallStatus: z.string().optional(),
  Direction: z.string().optional()
});

export const twilioVoiceStatusSchema = z.object({
  CallSid: z.string().min(1),
  AccountSid: z.string().optional(),
  ParentCallSid: z.string().optional(),
  From: z.string().optional(),
  To: z.string().optional(),
  CallStatus: z.string().optional(),
  DialCallStatus: z.string().optional(),
  AnsweredBy: z.string().optional(),
  CallDuration: z.union([z.string(), z.number()]).optional(),
  Duration: z.union([z.string(), z.number()]).optional(),
  Timestamp: z.string().optional()
});

export function parseTwilioDuration(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
