export type CallRowForDedupe = {
  id: string;
  startedAt: Date;
  fromNumber: string;
  outcome: string;
  durationSec: number | null;
  recordingUrl: string | null;
  transcript: string | null;
  aiSummary: string | null;
  endedAt: Date | null;
  completedAt: Date | null;
  leadId: string | null;
};

function hasText(value: string | null | undefined) {
  return Boolean(String(value || "").trim());
}

function getSignalScore(call: CallRowForDedupe) {
  let score = 0;
  if ((call.durationSec || 0) > 0) score += 3;
  if (hasText(call.recordingUrl)) score += 3;
  if (hasText(call.transcript)) score += 2;
  if (hasText(call.aiSummary)) score += 2;
  if (call.endedAt || call.completedAt) score += 1;
  if (call.leadId) score += 1;
  return score;
}

function isLowSignal(call: CallRowForDedupe) {
  return getSignalScore(call) <= 1;
}

export function dedupeOrgCallRows(rows: CallRowForDedupe[]) {
  const MAX_PAIR_GAP_MS = 5_000;
  const MIN_STRONG_SIGNAL_SCORE = 4;
  const suppressed = new Set<string>();

  for (const row of rows) {
    if (!isLowSignal(row)) continue;
    const rowTime = row.startedAt.getTime();

    const hasBetterSibling = rows.some((candidate) => {
      if (candidate.id === row.id) return false;
      if (candidate.fromNumber !== row.fromNumber) return false;
      if (candidate.outcome !== row.outcome) return false;
      if (Math.abs(candidate.startedAt.getTime() - rowTime) > MAX_PAIR_GAP_MS) return false;
      return getSignalScore(candidate) >= MIN_STRONG_SIGNAL_SCORE;
    });

    if (hasBetterSibling) suppressed.add(row.id);
  }

  return rows.filter((row) => !suppressed.has(row.id));
}
