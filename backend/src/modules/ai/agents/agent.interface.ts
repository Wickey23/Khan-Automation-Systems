export type PlannedTool = { toolKey: string; input: Record<string, unknown>; reason: string };

export type AgentPlanInput = {
  prompt: string;
  entityType?: string;
  entityId?: string;
  intent?: string;
};

export type AgentPlanner = {
  key: string;
  plan: (input: AgentPlanInput) => PlannedTool[];
};
