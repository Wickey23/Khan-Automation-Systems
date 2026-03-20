import type { ApprovalPolicy, UserRole } from "@prisma/client";
import type { z } from "zod";
import type { ToolExecutionResult } from "../ai.types";

export type ToolExecutionContext = {
  orgId: string;
  actorUserId: string;
  actorRole: UserRole;
  entityType?: string;
  entityId?: string;
  prompt: string;
};

export type ToolDefinition<TInput = Record<string, unknown>> = {
  key: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  requiredRoles: UserRole[];
  entityTypes: string[];
  approvalPolicy: ApprovalPolicy;
  idempotencyScope: "none" | "org_entity_tool";
  execute: (input: TInput, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
};
