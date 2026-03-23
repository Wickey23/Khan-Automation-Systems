"use client";

export type WorkflowContextPayload = {
  source?: string | null;
  returnTo?: string | null;
  returnLabel?: string | null;
};

export function appendQueryParams(href: string, params: Record<string, string | null | undefined>) {
  const [path, search = ""] = href.split("?");
  const query = new URLSearchParams(search);
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    query.set(key, value);
  }
  const next = query.toString();
  return next ? `${path}?${next}` : path;
}

export function buildReturnTo(pathname: string, searchParams?: URLSearchParams | null) {
  const query = searchParams?.toString() || "";
  return query ? `${pathname}?${query}` : pathname;
}

export function buildWorkflowHref(
  href: string,
  context: WorkflowContextPayload,
  extra?: Record<string, string | null | undefined>
) {
  return appendQueryParams(href, {
    source: context.source || undefined,
    returnTo: context.returnTo || undefined,
    returnLabel: context.returnLabel || undefined,
    ...(extra || {})
  });
}

export function normalizeReturnTo(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return "";
  if (trimmed.startsWith("//")) return "";
  return trimmed;
}

export function sourceToLabel(source: string | null | undefined) {
  if (!source) return "Queue";
  if (source === "attention") return "Needs Attention";
  if (source === "approvals") return "Approval Queue";
  if (source === "follow-up" || source === "followup") return "Follow-up Queue";
  if (source === "insights") return "Insights";
  if (source === "dashboard") return "Dashboard";
  return source.replace(/[-_]/g, " ");
}
