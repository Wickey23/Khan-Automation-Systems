import { z } from "zod";

export const aiRunCreateSchema = z.object({
  prompt: z.string().min(2).max(5000),
  agentKey: z
    .enum([
      "front_desk",
      "lead_ops",
      "communications",
      "scheduling",
      "crm_pipeline",
      "task_followup",
      "knowledge",
      "manager_analytics",
      "dispatch_ops"
    ])
    .optional(),
  intent: z.string().max(120).optional(),
  page: z.string().max(120).optional(),
  entityType: z.string().max(64).optional(),
  entityId: z.string().max(64).optional(),
  idempotencyKey: z.string().max(128).optional()
});

export const aiApprovalDecisionSchema = z.object({
  note: z.string().max(1000).optional(),
  mode: z.enum(["SEND_NOW", "APPROVE_ONLY"]).optional(),
  editedSubject: z.string().max(300).optional(),
  editedContent: z.string().max(6000).optional()
});

export const aiApprovalRetrySchema = z.object({
  note: z.string().max(1000).optional()
});

export const aiTimelineParamsSchema = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1).max(64)
});

export const aiRetryRunSchema = z.object({
  idempotencyKey: z.string().max(128).optional()
});

export const aiQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  status: z.string().optional(),
  filter: z.string().optional()
});

export const aiToolExecuteSchema = z.object({
  toolKey: z.string().min(2),
  input: z.record(z.unknown()).optional().default({}),
  agentKey: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  idempotencyKey: z.string().optional()
});

export const aiTaskUpdateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assignedToUserId: z.string().nullable().optional()
});

export const aiFollowUpQueueUpdateSchema = z.object({
  status: z.string().min(2).max(30)
});
