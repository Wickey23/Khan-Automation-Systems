import type { AgentPlanner } from "./agent.interface";

export const frontDeskAgent: AgentPlanner = {
  key: "front_desk",
  plan: (input) => {
    const planned = [{ toolKey: "summarize_call", input: { callId: input.entityId }, reason: "Summarize call context" }];
    if (input.prompt.toLowerCase().includes("urgent")) {
      planned.push({ toolKey: "detect_urgency", input: { callId: input.entityId }, reason: "Urgency requested" });
    }
    if (input.prompt.toLowerCase().includes("callback")) {
      planned.push({ toolKey: "draft_callback", input: { callId: input.entityId }, reason: "Callback draft requested" });
    }
    return planned;
  }
};
