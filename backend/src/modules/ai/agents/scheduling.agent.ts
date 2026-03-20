import type { AgentPlanner } from "./agent.interface";

export const schedulingAgent: AgentPlanner = {
  key: "scheduling",
  plan: () => [
    { toolKey: "check_availability", input: {}, reason: "Check baseline availability" },
    { toolKey: "suggest_slots", input: {}, reason: "Provide slot options" },
    { toolKey: "detect_schedule_conflict", input: {}, reason: "Detect scheduling conflicts" }
  ]
};
