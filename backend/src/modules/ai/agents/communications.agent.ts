import type { AgentPlanner } from "./agent.interface";

export const communicationsAgent: AgentPlanner = {
  key: "communications",
  plan: (input) => {
    const planned = [{ toolKey: "classify_message", input: { threadId: input.entityId }, reason: "Message triage" }];
    const prompt = input.prompt.toLowerCase();
    if (prompt.includes("reply") || prompt.includes("respond")) {
      planned.push({ toolKey: "draft_reply", input: { threadId: input.entityId }, reason: "Reply requested" });
    }
    if (prompt.includes("opt") || prompt.includes("stop")) {
      planned.push({ toolKey: "detect_opt_out", input: { threadId: input.entityId }, reason: "Opt-out safety check" });
    }
    return planned;
  }
};
