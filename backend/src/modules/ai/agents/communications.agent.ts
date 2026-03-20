import type { AgentPlanner } from "./agent.interface";

export const communicationsAgent: AgentPlanner = {
  key: "communications",
  plan: (input) => {
    const planned: Array<{ toolKey: string; input: Record<string, unknown>; reason: string }> = [
      { toolKey: "summarize_thread", input: { threadId: input.entityId }, reason: "Thread summary baseline" },
      { toolKey: "classify_message", input: { threadId: input.entityId }, reason: "Message triage" }
    ];
    const prompt = input.prompt.toLowerCase();
    if (prompt.includes("reply") || prompt.includes("respond")) {
      planned.push({ toolKey: "draft_reply", input: { threadId: input.entityId }, reason: "Reply requested" });
    }
    if (prompt.includes("opt") || prompt.includes("stop")) {
      planned.push({ toolKey: "detect_opt_out", input: { threadId: input.entityId }, reason: "Opt-out safety check" });
    }
    if (prompt.includes("route") || prompt.includes("queue")) {
      planned.push({ toolKey: "route_thread", input: { threadId: input.entityId, routeTo: "unresolved-inbox" }, reason: "Route thread requested" });
    }
    if (prompt.includes("status")) {
      planned.push({ toolKey: "mark_thread_status", input: { threadId: input.entityId, status: "PENDING" }, reason: "Thread status update requested" });
    }
    if (prompt.includes("follow-up") || prompt.includes("task")) {
      planned.push({ toolKey: "create_message_followup_task", input: { threadId: input.entityId }, reason: "Follow-up task requested" });
    }
    return planned;
  }
};
