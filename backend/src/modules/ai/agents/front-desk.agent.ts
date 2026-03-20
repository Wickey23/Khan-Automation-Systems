import type { AgentPlanner } from "./agent.interface";

export const frontDeskAgent: AgentPlanner = {
  key: "front_desk",
  plan: (input) => {
    const prompt = input.prompt.toLowerCase();
    const planned: Array<{ toolKey: string; input: Record<string, unknown>; reason: string }> = [
      { toolKey: "summarize_call", input: { callId: input.entityId }, reason: "Summarize call context" },
      { toolKey: "extract_call_details", input: { callId: input.entityId }, reason: "Extract structured call details" },
      { toolKey: "classify_call_intent", input: { callId: input.entityId }, reason: "Classify call intent" },
      { toolKey: "suggest_front_desk_action", input: { callId: input.entityId }, reason: "Recommend next front desk action" }
    ];
    if (prompt.includes("urgent")) {
      planned.push({ toolKey: "detect_urgency", input: { callId: input.entityId }, reason: "Urgency requested" });
    }
    if (prompt.includes("callback")) {
      planned.push({ toolKey: "draft_callback", input: { callId: input.entityId }, reason: "Callback draft requested" });
    }
    if (prompt.includes("follow-up") || prompt.includes("task")) {
      planned.push({ toolKey: "create_followup_task", input: { title: "Follow up call", priority: "HIGH" }, reason: "Create call follow-up task" });
    }
    return planned;
  }
};
