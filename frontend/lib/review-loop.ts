"use client";

const REVIEW_DIRTY_KEY = "ks_daily_review_dirty";

export function markDailyReviewDirty(reason: string) {
  if (typeof window === "undefined") return;
  const current = window.sessionStorage.getItem(REVIEW_DIRTY_KEY);
  const reasons = new Set<string>((current ? current.split(",") : []).filter(Boolean));
  reasons.add(reason);
  window.sessionStorage.setItem(REVIEW_DIRTY_KEY, Array.from(reasons).join(","));
}

export function consumeDailyReviewDirtyReasons() {
  if (typeof window === "undefined") return [];
  const current = window.sessionStorage.getItem(REVIEW_DIRTY_KEY);
  if (!current) return [];
  window.sessionStorage.removeItem(REVIEW_DIRTY_KEY);
  return current.split(",").filter(Boolean);
}
