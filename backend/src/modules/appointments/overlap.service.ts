export function overlapsLocked(existingStart: Date, existingEnd: Date, newStart: Date, newEnd: Date) {
  // Locked boundary semantics:
  // existing.endAt == new.startAt => NOT overlap
  // existing.startAt == new.endAt => NOT overlap
  return existingStart.getTime() < newEnd.getTime() && existingEnd.getTime() > newStart.getTime();
}

export function overlapsWithBufferLocked(
  existingStart: Date,
  existingEnd: Date,
  newStart: Date,
  newEnd: Date,
  bufferMinutes: number
) {
  const bufferMs = Math.max(0, bufferMinutes) * 60 * 1000;
  const expandedStart = new Date(existingStart.getTime() - bufferMs);
  const expandedEnd = new Date(existingEnd.getTime() + bufferMs);
  return overlapsLocked(expandedStart, expandedEnd, newStart, newEnd);
}

