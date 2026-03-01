import { z } from "zod";

export const createLeadSchema = z.object({
  name: z.string().min(2),
  business: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  industry: z.string().optional(),
  message: z.string().max(2000).optional(),
  preferredContact: z.enum(["call", "text", "email"]).optional(),
  urgency: z.enum(["this_week", "this_month", "exploring"]).optional(),
  sourcePage: z.string().optional(),
  orgId: z.string().optional(),
  source: z.enum(["WEB_FORM", "PHONE_CALL", "SMS"]).optional(),
  createAccount: z.boolean().optional().default(true)
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(),
  tags: z.string().optional(),
  notes: z.string().max(3000).optional()
});

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
