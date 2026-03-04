import { z } from "zod";

export const createCheckoutSessionSchema = z.object({
  plan: z.enum(["starter", "pro", "founding"])
});

export const changePlanSchema = z.object({
  plan: z.enum(["starter", "pro"])
});

export const createPlanChangeSessionSchema = z.object({
  targetPlan: z.enum(["starter", "pro"]),
  effective: z.enum(["immediate", "period_end"])
});

export const scheduleDowngradeSchema = z.object({
  targetPlan: z.literal("starter")
});
