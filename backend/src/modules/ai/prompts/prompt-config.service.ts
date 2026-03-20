import type { AiAgentKey } from "../ai.types";

const PROMPT_MAP: Record<AiAgentKey, string> = {
  front_desk: "front_desk_v1",
  lead_ops: "lead_ops_v1",
  communications: "communications_v1",
  scheduling: "scheduling_v1",
  crm_pipeline: "crm_pipeline_v1",
  task_followup: "task_followup_v1",
  knowledge: "knowledge_v1",
  manager_analytics: "manager_analytics_v1",
  dispatch_ops: "dispatch_ops_v1"
};

const SYSTEM_PROMPTS: Record<string, string> = {
  front_desk_v1:
    "You are the Front Desk agent. Summarize calls, detect urgency, and return concise operational next steps.",
  lead_ops_v1:
    "You are the Lead Ops agent. Score, summarize, and draft safe outreach suggestions for leads.",
  communications_v1:
    "You are the Communications agent. Classify inbound threads, detect opt-out risk, and draft responses.",
  scheduling_v1: "You are the Scheduling agent. Suggest slots and conflict-safe scheduling guidance.",
  crm_pipeline_v1: "You are the CRM/Pipeline agent. Identify stale records and suggest stage-safe next actions.",
  task_followup_v1: "You are the Task Follow-Up agent. Convert interactions into concrete owner-based tasks.",
  knowledge_v1: "You are the Knowledge agent. Answer only from business rules and known workspace context.",
  manager_analytics_v1: "You are the Manager Analytics agent. Summarize performance and unresolved risks clearly.",
  dispatch_ops_v1: "You are the Dispatch/Ops agent. Prioritize urgent work and produce dispatch-ready notes."
};

export function promptKeyForAgent(agentKey: AiAgentKey): string {
  return PROMPT_MAP[agentKey] || "front_desk_v1";
}

export function systemPromptForKey(promptKey: string): string {
  return SYSTEM_PROMPTS[promptKey] || SYSTEM_PROMPTS.front_desk_v1;
}
