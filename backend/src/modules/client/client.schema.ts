import { z } from "zod";

export const updateSettingSchema = z.object({
  name: z.string().min(2).optional(),
  businessHoursJson: z.string().min(2).optional(),
  transferNumber: z.string().min(7).optional(),
  servicesJson: z.string().optional().nullable(),
  bookingLink: z.string().url().optional().nullable(),
  paused: z.boolean().optional()
});

export const supportSchema = z.object({
  subject: z.string().min(2),
  message: z.string().min(10)
});
