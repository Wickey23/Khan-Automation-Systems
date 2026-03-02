import { z } from "zod";

export const leadFilterSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(),
  industry: z.string().optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.string().optional(),
  page: z.string().optional(),
  sort: z.enum(["createdAt:desc", "createdAt:asc"]).optional()
});

export const updateLeadSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(),
  tags: z.string().optional(),
  notes: z.string().max(3000).optional()
});

export const updateClientStatusSchema = z.object({
  status: z.enum(["LIVE", "PAUSED", "NEEDS_CONFIGURATION", "CANCELED"])
});

export const assignNumberSchema = z.object({
  areaCode: z.string().length(3).optional(),
  sms: z.boolean().optional().default(false)
});

export const updateAiConfigSchema = z.object({
  vapiAgentId: z.string().max(200).nullable().optional(),
  vapiPhoneNumberId: z.string().max(200).nullable().optional(),
  model: z.string().max(200).nullable().optional(),
  voice: z.string().max(200).nullable().optional(),
  temperature: z.number().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional(),
  greetingText: z.string().max(4000).nullable().optional(),
  systemPrompt: z.string().max(12000).nullable().optional(),
  toolsJson: z.string().max(12000).nullable().optional(),
  intakeSchemaJson: z.string().max(12000).nullable().optional(),
  intakeQuestionsJson: z.string().max(12000).nullable().optional(),
  transferRulesJson: z.string().max(12000).nullable().optional(),
  afterHoursMessage: z.string().max(4000).nullable().optional(),
  smsEnabled: z.boolean().optional(),
  testMode: z.boolean().optional()
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8).max(128)
});

export const provisioningStepUpdateSchema = z.object({
  stepKey: z.string().min(2),
  status: z.enum(["TODO", "DONE", "BLOCKED"]),
  notes: z.string().max(2000).optional()
});

export const clearAllDataSchema = z.object({
  password: z.string().min(8).max(128),
  confirmationText: z.string().min(1)
});
