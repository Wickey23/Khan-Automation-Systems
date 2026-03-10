export const voiceRoutingModes = ["AI_FIRST", "PASSIVE_FORWARDING"] as const;

export type VoiceRoutingMode = (typeof voiceRoutingModes)[number];

export function isVoiceRoutingMode(value: unknown): value is VoiceRoutingMode {
  return typeof value === "string" && voiceRoutingModes.includes(value as VoiceRoutingMode);
}
