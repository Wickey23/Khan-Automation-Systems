import type { AgentPlanner } from "./agent.interface";

export const managerAnalyticsAgent: AgentPlanner = {
  key: "manager_analytics",
  plan: () => {
    return [
      { toolKey: "summarize_workspace_activity", input: {}, reason: "Generate activity snapshot" },
      { toolKey: "compute_missed_opportunities", input: {}, reason: "Surface missed-opportunity signal" },
      { toolKey: "identify_response_delays", input: {}, reason: "Surface response-time risks" },
      { toolKey: "generate_manager_report", input: {}, reason: "Generate manager summary" }
    ];
  }
};
