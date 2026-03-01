import { z } from "zod";

export const leadFormSchema = z.object({
  name: z.string().min(2, "Name is required."),
  business: z.string().min(2, "Business is required."),
  email: z.string().email("Valid email is required."),
  phone: z.string().min(7, "Valid phone is required."),
  industry: z.string().optional(),
  message: z.string().max(1000, "Message must be under 1000 chars.").optional(),
  preferredContact: z.enum(["call", "text", "email"]).optional(),
  urgency: z.enum(["this_week", "this_month", "exploring"]).optional(),
  sourcePage: z.string().min(1)
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;

export const adminLoginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password is required.")
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const leadUpdateSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(),
  tags: z.string().optional(),
  notes: z.string().max(3000).optional()
});

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export const signupSchema = z.object({
  name: z.string().min(2, "Name is required."),
  business: z.string().min(2, "Business name is required."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  industry: z.string().optional()
});

export type SignupInput = z.infer<typeof signupSchema>;
