import type { AgentPlanner } from "./agent.interface";

export const dispatchOpsAgent: AgentPlanner = {
  key: "dispatch_ops",
  plan: () => [
    { toolKey: "prioritize_jobs", input: {}, reason: "Prioritize dispatch workload" },
    { toolKey: "prepare_dispatch_notes", input: {}, reason: "Prepare dispatch notes" }
  ]
};
