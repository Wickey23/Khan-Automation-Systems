"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchEntityAiTimeline } from "@/lib/api";
import type { EntityAiTimelineResponse } from "@/lib/types";

type UseEntityAiStateResult = {
  data: EntityAiTimelineResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useEntityAiState(entityType?: string, entityId?: string): UseEntityAiStateResult {
  const [data, setData] = useState<EntityAiTimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const key = useMemo(() => (entityType && entityId ? `${entityType}:${entityId}` : ""), [entityId, entityType]);

  const load = useCallback(async () => {
    if (!entityType || !entityId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchEntityAiTimeline(entityType, entityId);
      if (requestIdRef.current !== requestId) return;
      setData(next);
    } catch (loadError) {
      if (requestIdRef.current !== requestId) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load entity state.");
      setData(null);
    } finally {
      if (requestIdRef.current !== requestId) return;
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    if (!key) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    void load();
  }, [key, load]);

  return { data, loading, error, refresh: load };
}

