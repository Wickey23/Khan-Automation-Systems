import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const outreachLeadCreateSchema = z.object({
  orgId: z.string().min(1).optional(),
  companyName: optionalTrimmed,
  contactName: optionalTrimmed,
  email: z.string().trim().email().optional(),
  phone: optionalTrimmed,
  city: optionalTrimmed,
  state: optionalTrimmed,
  industry: optionalTrimmed,
  website: optionalTrimmed,
  angle: optionalTrimmed,
  painPoint: optionalTrimmed,
  offer: optionalTrimmed,
  sourceList: optionalTrimmed,
  notes: optionalTrimmed,
  status: z.enum(["NEW", "ACTIVE", "PAUSED", "REPLIED", "BOUNCED", "UNSUBSCRIBED", "COMPLETED"]).optional()
});

export const outreachLeadUpdateSchema = z.object({
  companyName: optionalTrimmed,
  contactName: optionalTrimmed,
  email: z.string().trim().email().optional(),
  phone: optionalTrimmed,
  city: optionalTrimmed,
  state: optionalTrimmed,
  industry: optionalTrimmed,
  website: optionalTrimmed,
  angle: optionalTrimmed,
  painPoint: optionalTrimmed,
  offer: optionalTrimmed,
  sourceList: optionalTrimmed,
  notes: optionalTrimmed,
  status: z.enum(["NEW", "ACTIVE", "PAUSED", "REPLIED", "BOUNCED", "UNSUBSCRIBED", "COMPLETED"]).optional()
});

export const outreachBulkImportSchema = z.object({
  orgId: z.string().min(1).optional(),
  sequenceId: z.string().min(1).optional(),
  callerConfigId: z.string().min(1).optional(),
  mode: z.enum(["EMAIL", "PHONE"]).optional(),
  text: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
  confirmed: z.boolean().optional().default(false)
});

export const outreachBulkDeleteSchema = z.object({
  confirmed: z.boolean()
});

export const outreachSequenceStepInputSchema = z.object({
  stepNumber: z.number().int().min(1),
  delayHours: z.number().int().min(0),
  subject: z.string().trim().min(1),
  bodyHtml: z.string().trim().optional(),
  bodyText: z.string().trim().optional()
}).superRefine((value, ctx) => {
  if (!value.bodyHtml && !value.bodyText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Step requires bodyHtml or bodyText.",
      path: ["bodyText"]
    });
  }
});

export const outreachSequenceCreateSchema = z.object({
  orgId: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  description: optionalTrimmed,
  isActive: z.boolean().optional(),
  steps: z.array(outreachSequenceStepInputSchema).min(1)
});

export const outreachSequenceUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: optionalTrimmed,
  isActive: z.boolean().optional()
});

export const outreachSequenceReplaceStepsSchema = z.object({
  steps: z.array(outreachSequenceStepInputSchema).min(1)
});

export const outreachEnrollmentCreateSchema = z.object({
  orgId: z.string().min(1).optional(),
  leadId: z.string().min(1),
  sequenceId: z.string().min(1),
  startAt: z.string().datetime().optional()
});

export const outreachPhoneEnrollmentCreateSchema = z.object({
  orgId: z.string().min(1).optional(),
  leadId: z.string().min(1),
  callerConfigId: z.string().min(1),
  startAt: z.string().datetime().optional()
});

export const outreachCallerConfigCreateSchema = z.object({
  orgId: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  description: optionalTrimmed,
  isActive: z.boolean().optional(),
  vapiAssistantId: optionalTrimmed,
  vapiPhoneNumberId: optionalTrimmed,
  twilioFromNumber: optionalTrimmed,
  timezone: z.string().trim().min(1).optional(),
  windowStartHour: z.number().int().min(0).max(23).optional(),
  windowEndHour: z.number().int().min(1).max(24).optional(),
  maxCallsPerDay: z.number().int().min(1).max(500).optional(),
  prompt: optionalTrimmed
});

export const outreachCallerConfigUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: optionalTrimmed,
  isActive: z.boolean().optional(),
  vapiAssistantId: optionalTrimmed,
  vapiPhoneNumberId: optionalTrimmed,
  twilioFromNumber: optionalTrimmed,
  timezone: z.string().trim().min(1).optional(),
  windowStartHour: z.number().int().min(0).max(23).optional(),
  windowEndHour: z.number().int().min(1).max(24).optional(),
  maxCallsPerDay: z.number().int().min(1).max(500).optional(),
  prompt: optionalTrimmed
});

export const outreachLeadSuppressSchema = z.object({
  orgId: z.string().min(1).optional(),
  reason: z.string().trim().min(1).default("MANUAL"),
  source: z.string().trim().min(1).default("ADMIN")
});

export const outreachMarkRepliedSchema = z.object({
  orgId: z.string().min(1).optional(),
  note: z.string().trim().optional()
});

export const outreachListQuerySchema = z.object({
  orgId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  eventType: z.string().trim().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).optional()
});

export function validateOrderedSteps(
  steps: Array<z.infer<typeof outreachSequenceStepInputSchema>>
) {
  const sorted = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index].stepNumber !== index + 1) {
      throw new Error("Sequence steps must be numbered sequentially starting at 1.");
    }
  }
  return sorted;
}
