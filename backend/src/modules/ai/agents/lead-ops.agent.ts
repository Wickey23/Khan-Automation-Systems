import type { AgentPlanner } from "./agent.interface";

export const leadOpsAgent: AgentPlanner = {
  key: "lead_ops",
  plan: (input) => {
    const planned = [{ toolKey: "score_lead", input: { leadId: input.entityId }, reason: "Lead scoring baseline" }];
    const prompt = input.prompt.toLowerCase();
    if (prompt.includes("email")) planned.push({ toolKey: "draft_outreach_email", input: { leadId: input.entityId }, reason: "Email draft requested" });
    if (prompt.includes("sms") || prompt.includes("text")) planned.push({ toolKey: "draft_outreach_sms", input: { leadId: input.entityId }, reason: "SMS draft requested" });
    if (prompt.includes("prep") || prompt.includes("call")) planned.push({ toolKey: "generate_call_prep", input: { leadId: input.entityId }, reason: "Call prep requested" });
    return planned;
  }
};
