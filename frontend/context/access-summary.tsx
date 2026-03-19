"use client";

import { createContext, useContext } from "react";
import type { OrgAccessSummary } from "@/lib/types";

const AccessSummaryContext = createContext<OrgAccessSummary | null>(null);

export function AccessSummaryProvider({
  value,
  children
}: {
  value: OrgAccessSummary | null;
  children: React.ReactNode;
}) {
  return <AccessSummaryContext.Provider value={value}>{children}</AccessSummaryContext.Provider>;
}

export function useAccessSummary() {
  return useContext(AccessSummaryContext);
}
