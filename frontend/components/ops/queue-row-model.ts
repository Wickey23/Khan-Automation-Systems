import type { ActionQueueRow } from "@/components/ops/action-queue-table";

export function priorityToSeverity(priority?: string | null): ActionQueueRow["severity"] {
  const normalized = String(priority || "").toLowerCase();
  if (normalized.includes("critical") || normalized.includes("urgent")) return "critical";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium") || normalized.includes("normal")) return "medium";
  return "low";
}

export function statusToOperatorState(status?: string | null): ActionQueueRow["status"] {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("block") || normalized.includes("fail") || normalized.includes("error")) return "blocked";
  if (normalized.includes("pending") || normalized.includes("needs") || normalized.includes("open")) return "pending";
  if (normalized.includes("progress") || normalized.includes("sending") || normalized.includes("queued")) return "in_progress";
  return "done";
}

export function ageFromDate(value?: string | null) {
  if (!value) return "-";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function dueLabel(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
