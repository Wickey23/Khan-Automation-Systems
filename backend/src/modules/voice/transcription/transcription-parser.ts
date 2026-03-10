import { z } from "zod";
import type { NormalizedTranscriptEvent, TranscriptSpeaker, TranscriptTrack } from "./transcription-adapter";

const deepgramAlternativeSchema = z.object({
  transcript: z.string().optional(),
  confidence: z.number().optional(),
  words: z
    .array(
      z.object({
        start: z.number().optional(),
        end: z.number().optional(),
        word: z.string().optional()
      })
    )
    .optional()
});

const deepgramResultsSchema = z.object({
  type: z.string().optional(),
  is_final: z.boolean().optional(),
  start: z.number().optional(),
  duration: z.number().optional(),
  channel_index: z.array(z.number()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  channel: z
    .object({
      alternatives: z.array(deepgramAlternativeSchema).optional()
    })
    .optional()
});

export function mapTrackToSpeaker(track: TranscriptTrack): TranscriptSpeaker {
  if (track === "inbound_track") return "CALLER";
  if (track === "outbound_track") return "AGENT";
  return "UNKNOWN";
}

export function normalizeDeepgramTranscriptEvent(input: {
  sessionId: string;
  track: TranscriptTrack;
  payload: unknown;
}): NormalizedTranscriptEvent | null {
  const parsed = deepgramResultsSchema.safeParse(input.payload);
  if (!parsed.success) return null;

  const payload = parsed.data;
  const alternative = payload.channel?.alternatives?.[0];
  const text = String(alternative?.transcript || "").trim();
  if (!text) return null;

  const wordTimes = alternative?.words || [];
  const startFromWords = wordTimes[0]?.start;
  const endFromWords = wordTimes[wordTimes.length - 1]?.end;
  const startSeconds = typeof startFromWords === "number" ? startFromWords : payload.start || 0;
  const endSeconds =
    typeof endFromWords === "number"
      ? endFromWords
      : typeof payload.start === "number" && typeof payload.duration === "number"
        ? payload.start + payload.duration
        : startSeconds;

  return {
    sessionId: input.sessionId,
    track: input.track,
    speaker: mapTrackToSpeaker(input.track),
    text,
    confidence: alternative?.confidence,
    startTimeMs: Math.max(0, Math.round(startSeconds * 1000)),
    endTimeMs: Math.max(0, Math.round(endSeconds * 1000)),
    isFinal: payload.is_final === true,
    providerSegmentId:
      typeof payload.metadata?.request_id === "string"
        ? payload.metadata.request_id
        : typeof payload.metadata?.transaction_key === "string"
          ? payload.metadata.transaction_key
          : undefined
  };
}
