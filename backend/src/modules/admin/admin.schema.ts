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

export const callFilterSchema = z.object({
  outcome: z.enum(["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"]).optional(),
  orgId: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  page: z.string().optional()
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

export const deleteItemSchema = z.object({
  password: z.string().min(1).max(128)
});

export const prospectFilterSchema = z.object({
  status: z.enum(["NEW", "QUALIFIED", "CONTACTED", "NURTURE", "WON", "LOST"]).optional(),
  search: z.string().optional(),
  orgId: z.string().optional(),
  limit: z.string().optional(),
  page: z.string().optional()
});

export const createProspectSchema = z.object({
  orgId: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  business: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  website: z.string().max(255).optional().nullable(),
  industry: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(120).optional().nullable(),
  status: z.enum(["NEW", "QUALIFIED", "CONTACTED", "NURTURE", "WON", "LOST"]).optional(),
  tags: z.string().max(1000).optional(),
  notes: z.string().max(5000).optional().nullable()
});

export const updateProspectSchema = createProspectSchema.partial().extend({
  source: z.enum(["MANUAL", "CSV_IMPORT", "ENRICHED"]).optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  scoreReason: z.string().max(1000).optional().nullable()
});

export const importProspectsSchema = z.object({
  orgId: z.string().optional().nullable(),
  csv: z.string().min(1)
});

export const discoverProspectsSchema = z.object({
  orgId: z.string().optional().nullable(),
  location: z.string().max(200).optional().default(""),
  keywords: z.array(z.string().min(2).max(80)).optional(),
  limit: z.number().int().min(1).max(100).optional().default(30)
});

export const createTestRunSchema = z.object({
  scenarioId: z.string().min(1),
  status: z.enum(["PASS", "FAIL"]),
  notes: z.string().max(5000).optional(),
  providerCallId: z.string().max(200).optional()
});

export const eventsFilterSchema = z.object({
  orgId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.string().optional()
});

export const usersFilterSchema = z.object({
  search: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "CLIENT_ADMIN", "CLIENT_STAFF", "CLIENT"]).optional(),
  limit: z.string().optional()
});

export const updateAdminUserSchema = z.object({
  role: z.enum(["SUPER_ADMIN", "ADMIN", "CLIENT_ADMIN", "CLIENT_STAFF", "CLIENT"]).optional()
});

export const relinkCallSchema = z.object({
  callId: z.string().min(1),
  leadId: z.string().min(1)
});

export const mergeLeadsSchema = z.object({
  primaryLeadId: z.string().min(1),
  duplicateLeadIds: z.array(z.string().min(1)).min(1).max(50)
});
