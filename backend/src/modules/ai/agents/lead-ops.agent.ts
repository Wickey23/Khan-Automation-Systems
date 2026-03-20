import type { AgentPlanner } from "./agent.interface";

export const leadOpsAgent: AgentPlanner = {
  key: "lead_ops",
  plan: (input) => {
    const planned: Array<{ toolKey: string; input: Record<string, unknown>; reason: string }> = [
      { toolKey: "score_lead", input: { leadId: input.entityId }, reason: "Lead scoring baseline" },
      { toolKey: "summarize_lead", input: { leadId: input.entityId }, reason: "Lead summary baseline" }
    ];
    const prompt = input.prompt.toLowerCase();
    if (prompt.includes("import") || prompt.includes("csv")) planned.push({ toolKey: "preview_import", input: {}, reason: "Import preview requested" });
    if (prompt.includes("dedupe") || prompt.includes("duplicate")) planned.push({ toolKey: "dedupe_leads", input: {}, reason: "Dedupe requested" });
    if (prompt.includes("email")) planned.push({ toolKey: "draft_outreach_email", input: { leadId: input.entityId }, reason: "Email draft requested" });
    if (prompt.includes("sms") || prompt.includes("text")) planned.push({ toolKey: "draft_outreach_sms", input: { leadId: input.entityId }, reason: "SMS draft requested" });
    if (prompt.includes("prep") || prompt.includes("call")) planned.push({ toolKey: "generate_call_prep", input: { leadId: input.entityId }, reason: "Call prep requested" });
    if (prompt.includes("reply")) planned.push({ toolKey: "classify_lead_reply", input: { leadId: input.entityId }, reason: "Reply classification requested" });
    if (prompt.includes("follow-up") || prompt.includes("task")) planned.push({ toolKey: "schedule_lead_followup", input: { leadId: input.entityId }, reason: "Schedule follow-up requested" });
    return planned;
  }
};
