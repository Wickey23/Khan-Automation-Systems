import { AiAgentDomain, ApprovalPolicy } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { AgentDefinitionView, AiAgentKey } from "../ai.types";
import { promptKeyForAgent } from "../prompts/prompt-config.service";

type SeedAgent = {
  key: AiAgentKey;
  name: string;
  description: string;
  domain: AiAgentDomain;
  allowedTools: string[];
  allowedEntities: string[];
};

const DEFAULT_AGENTS: SeedAgent[] = [
  {
    key: "front_desk",
    name: "Front Desk Agent",
    description: "Call triage, summaries, urgency, and callback recommendations.",
    domain: AiAgentDomain.FRONT_DESK,
    allowedTools: [
      "summarize_call",
      "extract_call_details",
      "classify_call_intent",
      "detect_urgency",
      "suggest_front_desk_action",
      "draft_callback",
      "create_followup_task",
      "queue_sms"
    ],
    allowedEntities: ["call", "lead"]
  },
  {
    key: "lead_ops",
    name: "Lead Ops Agent",
    description: "Lead scoring, fit explanations, and outreach draft assistance.",
    domain: AiAgentDomain.LEAD_OPS,
    allowedTools: [
      "preview_import",
      "import_leads",
      "dedupe_leads",
      "score_lead",
      "summarize_lead",
      "draft_outreach_email",
      "draft_outreach_sms",
      "classify_lead_reply",
      "generate_call_prep",
      "mark_lead_status",
      "schedule_lead_followup",
      "queue_email",
      "queue_sms"
    ],
    allowedEntities: ["lead", "organization"]
  },
  {
    key: "communications",
    name: "Communications Agent",
    description: "Thread classification and response drafting for inbox workflows.",
    domain: AiAgentDomain.COMMUNICATIONS,
    allowedTools: [
      "summarize_thread",
      "classify_message",
      "detect_opt_out",
      "draft_reply",
      "route_thread",
      "mark_thread_status",
      "create_message_followup_task",
      "queue_sms"
    ],
    allowedEntities: ["message_thread", "lead"]
  },
  {
    key: "scheduling",
    name: "Scheduling Agent",
    description: "Availability guidance and conflict-safe appointment suggestions.",
    domain: AiAgentDomain.SCHEDULING,
    allowedTools: ["check_availability", "suggest_slots", "detect_schedule_conflict"],
    allowedEntities: ["appointment", "lead"]
  },
  {
    key: "crm_pipeline",
    name: "CRM/Pipeline Agent",
    description: "Pipeline hygiene, stale detection, and next-step recommendations.",
    domain: AiAgentDomain.CRM_PIPELINE,
    allowedTools: ["suggest_pipeline_stage", "detect_stale_record", "recommend_next_step"],
    allowedEntities: ["lead", "organization"]
  },
  {
    key: "task_followup",
    name: "Task/Follow-Up Agent",
    description: "Create, assign, and prioritize operational follow-up tasks.",
    domain: AiAgentDomain.TASK_FOLLOW_UP,
    allowedTools: [
      "create_task",
      "assign_task",
      "suggest_due_date",
      "create_reminder",
      "schedule_followup",
      "build_callback_queue",
      "escalate_overdue_item"
    ],
    allowedEntities: ["call", "message_thread", "lead", "appointment", "task"]
  },
  {
    key: "knowledge",
    name: "Knowledge Agent",
    description: "Workspace policy and business-rules Q&A layer.",
    domain: AiAgentDomain.KNOWLEDGE,
    allowedTools: ["fetch_business_context", "search_workspace_knowledge", "answer_internal_question"],
    allowedEntities: ["organization", "lead", "call", "message_thread"]
  },
  {
    key: "manager_analytics",
    name: "Manager Analytics Agent",
    description: "Summarizes operational metrics and unresolved workload risks.",
    domain: AiAgentDomain.MANAGER_ANALYTICS,
    allowedTools: ["summarize_workspace_activity", "compute_missed_opportunities", "identify_response_delays", "generate_manager_report"],
    allowedEntities: ["organization"]
  },
  {
    key: "dispatch_ops",
    name: "Dispatch/Ops Agent",
    description: "Service-priority guidance and dispatch notes foundation.",
    domain: AiAgentDomain.DISPATCH_OPS,
    allowedTools: ["prioritize_jobs", "prepare_dispatch_notes"],
    allowedEntities: ["lead", "appointment", "organization"]
  }
];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function ensureAgentRegistrySeeded() {
  for (const agent of DEFAULT_AGENTS) {
    await prisma.agentDefinition.upsert({
      where: { key: agent.key },
      update: {
        name: agent.name,
        description: agent.description,
        domain: agent.domain,
        allowedToolsJson: agent.allowedTools,
        allowedEntitiesJson: agent.allowedEntities,
        promptKey: promptKeyForAgent(agent.key)
      },
      create: {
        key: agent.key,
        name: agent.name,
        description: agent.description,
        domain: agent.domain,
        enabled: true,
        allowedToolsJson: agent.allowedTools,
        allowedEntitiesJson: agent.allowedEntities,
        approvalPolicy: ApprovalPolicy.ALWAYS,
        modelProvider: "openai",
        modelName: null,
        promptKey: promptKeyForAgent(agent.key),
        visibilityRulesJson: {},
        priority: 100
      }
    });
  }
}

export async function fetchRegistryForOrg(orgId: string): Promise<AgentDefinitionView[]> {
  await ensureAgentRegistrySeeded();

  const [definitions, overrides] = await Promise.all([
    prisma.agentDefinition.findMany({ where: { enabled: true }, orderBy: [{ priority: "asc" }, { name: "asc" }] }),
    prisma.workspaceAgentSetting.findMany({ where: { orgId } })
  ]);

  const byDefinitionId = new Map(overrides.map((item) => [item.agentDefinitionId, item]));

  return definitions
    .filter((definition) => {
      const override = byDefinitionId.get(definition.id);
      return override ? override.enabled : definition.enabled;
    })
    .map((definition) => {
      const override = byDefinitionId.get(definition.id);
      const effectiveTools =
        override && Array.isArray(override.allowedToolsJson) && override.allowedToolsJson.length > 0
          ? asStringArray(override.allowedToolsJson)
          : asStringArray(definition.allowedToolsJson);
      return {
        id: definition.id,
        key: definition.key as AiAgentKey,
        name: definition.name,
        description: definition.description,
        domain: definition.domain,
        enabled: override ? override.enabled : definition.enabled,
        approvalPolicy: override?.approvalPolicyOverride || definition.approvalPolicy,
        promptKey: definition.promptKey,
        modelProvider: definition.modelProvider,
        modelName: definition.modelName,
        allowedTools: effectiveTools,
        allowedEntities: asStringArray(definition.allowedEntitiesJson)
      };
    });
}

export function selectAgentByKey(registry: AgentDefinitionView[], key?: string) {
  if (key) {
    const match = registry.find((agent) => agent.key === key);
    if (match) return { agent: match, routeReason: "explicit_agent" as const };
  }
  return null;
}
