export type QueueFocusResolution = {
  nextId: string;
  outcome: "kept" | "moved" | "empty";
};

export function resolvePostActionFocus(
  previousIds: string[],
  nextIds: string[],
  actedId: string
): QueueFocusResolution {
  if (!nextIds.length) {
    return { nextId: "", outcome: "empty" };
  }
  if (nextIds.includes(actedId)) {
    return { nextId: actedId, outcome: "kept" };
  }
  const previousIndex = previousIds.indexOf(actedId);
  if (previousIndex >= 0) {
    const nextIndex = Math.min(previousIndex, nextIds.length - 1);
    return { nextId: nextIds[nextIndex], outcome: "moved" };
  }
  return { nextId: nextIds[0], outcome: "moved" };
}

