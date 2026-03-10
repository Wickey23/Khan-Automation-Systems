export const voiceMediaTrackStrategies = ["BOTH_TRACKS"] as const;
export type VoiceMediaTrackStrategy = (typeof voiceMediaTrackStrategies)[number];

export const voiceMediaStreamStatuses = [
  "CONNECTED",
  "STARTED",
  "ACTIVE",
  "STOPPED",
  "ERROR",
  "DISCONNECTED"
] as const;
export type VoiceMediaStreamStatus = (typeof voiceMediaStreamStatuses)[number];

export function mapTrackStrategyToTwilioTrack(strategy: VoiceMediaTrackStrategy) {
  return strategy === "BOTH_TRACKS" ? "both_tracks" : "both_tracks";
}
