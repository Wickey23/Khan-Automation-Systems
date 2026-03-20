import type { AgentPlanner } from "./agent.interface";

export const crmPipelineAgent: AgentPlanner = {
  key: "crm_pipeline",
  plan: () => [
    { toolKey: "detect_stale_record", input: {}, reason: "Find stale pipeline records" },
    { toolKey: "suggest_pipeline_stage", input: {}, reason: "Recommend pipeline stage" },
    { toolKey: "recommend_next_step", input: {}, reason: "Recommend next step" }
  ]
};
