export const transcriptSpeakers = ["CALLER", "AGENT", "UNKNOWN"] as const;
export type TranscriptSpeaker = (typeof transcriptSpeakers)[number];

export const transcriptionSessionStatuses = ["STARTED", "ACTIVE", "ENDED", "ERROR"] as const;
export type TranscriptionSessionStatus = (typeof transcriptionSessionStatuses)[number];

export const callTranscriptStatuses = ["STARTED", "GENERATED", "ERROR"] as const;
export type CallTranscriptStatus = (typeof callTranscriptStatuses)[number];

export type TranscriptTrack = "inbound_track" | "outbound_track" | "unknown";

export type NormalizedTranscriptEvent = {
  sessionId: string;
  track: TranscriptTrack;
  speaker: TranscriptSpeaker;
  text: string;
  confidence?: number;
  startTimeMs: number;
  endTimeMs: number;
  isFinal: boolean;
  providerSegmentId?: string;
};

export interface StreamingTranscriptionAdapter {
  startSession(input: {
    sessionId: string;
    callLogId: string;
    streamSessionId: string;
    orgId: string;
  }): Promise<void>;
  sendAudio(input: {
    sessionId: string;
    track: "inbound_track" | "outbound_track";
    audio: Buffer;
    sequenceNumber?: number;
    timestampMs?: number;
  }): Promise<void>;
  finishSession(input: { sessionId: string }): Promise<void>;
}
