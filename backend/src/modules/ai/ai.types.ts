import type { AiActionStatus, AiAgentDomain, AiRunStatus, ApprovalPolicy, ApprovalStatus, UserRole } from "@prisma/client";

export type AiAgentKey =
  | "front_desk"
  | "lead_ops"
  | "communications"
  | "scheduling"
  | "crm_pipeline"
  | "task_followup"
  | "knowledge"
  | "manager_analytics"
  | "dispatch_ops";

export type AiEntityType = "call" | "message_thread" | "lead" | "appointment" | "organization" | "task" | "unknown";

export type AiToolApprovalMode = "ALWAYS" | "CONDITIONAL" | "NONE";

export type AiRouteReason =
  | "explicit_agent"
  | "page_context"
  | "intent_routing"
  | "fallback_front_desk"
  | "retry";

export type AiRunContext = {
  orgId: string;
  actorUserId: string;
  actorRole: UserRole;
  page?: string;
  entityType?: string;
  entityId?: string;
  idempotencyKey?: string;
};

export type AiRunRequest = {
  prompt: string;
  agentKey?: AiAgentKey;
  intent?: string;
  page?: string;
  entityType?: string;
  entityId?: string;
  idempotencyKey?: string;
};

export type AiRunResponse = {
  runId: string;
  status: AiRunStatus;
  agentKey: AiAgentKey;
  routeReason: AiRouteReason;
  summary?: string;
  approvalRequired: boolean;
  approvalRequestId?: string;
  actions: Array<{
    toolKey: string;
    status: AiActionStatus;
    approvalStatus?: ApprovalStatus;
    message?: string;
  }>;
};

export type ToolExecutionResult = {
  ok: boolean;
  status: AiActionStatus;
  message: string;
  outputSummary?: string;
  approvalRequired?: boolean;
  approvalRequestId?: string;
  output?: Record<string, unknown>;
};

export type AgentDefinitionView = {
  id: string;
  key: AiAgentKey;
  name: string;
  description: string;
  domain: AiAgentDomain;
  enabled: boolean;
  approvalPolicy: ApprovalPolicy;
  promptKey: string;
  modelProvider: string;
  modelName: string | null;
  allowedTools: string[];
  allowedEntities: string[];
};

export type ApprovalDecision = "APPROVED" | "REJECTED";

export type AiTimelineEvent = {
  id: string;
  type: "audit" | "run" | "action" | "approval";
  createdAt: string;
  title: string;
  detail?: string;
  status?: string;
  actor?: string | null;
};
