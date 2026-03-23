"use client";

import { useMemo } from "react";
import { useEntityAiState } from "@/lib/hooks/use-entity-ai-state";

const SUPPORTED_ENTITY_TYPES = new Set(["call", "lead", "message_thread"]);

type EnrichmentEvent = {
  id: string;
  label: string;
  at: string;
};

export function useQueueTriageEnrichment(entityType?: string | null, entityId?: string | null) {
  const supported = Boolean(entityType && entityId && SUPPORTED_ENTITY_TYPES.has(entityType));
  const state = useEntityAiState(supported ? entityType || undefined : undefined, supported ? entityId || undefined : undefined);

  const recentEvents = useMemo<EnrichmentEvent[]>(() => {
    if (!state.data) return [];
    const auditEvents = (state.data.audit || []).map((event) => ({
      id: `audit-${event.id}`,
      label: event.action,
      at: event.createdAt
    }));
    const handoffEvents = (state.data.handoffs || []).map((event) => ({
      id: `handoff-${event.id}`,
      label: `${event.sourceAgent || "agent"} -> ${event.targetAgent || "agent"} (${event.targetTool || "tool"})`,
      at: event.at
    }));
    const approvalEvents = (state.data.approvals || []).map((event) => ({
      id: `approval-${event.id}`,
      label: `Approval ${event.status}${event.deliveryStatus ? ` / ${event.deliveryStatus}` : ""}`,
      at: event.updatedAt
    }));
    return [...auditEvents, ...handoffEvents, ...approvalEvents]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 4);
  }, [state.data]);

  return {
    supported,
    loading: supported ? state.loading : false,
    error: supported ? state.error : null,
    data: supported ? state.data : null,
    recentEvents,
    refresh: state.refresh
  };
}
