import { z } from "zod";

export const createCheckoutSessionSchema = z.object({
  plan: z.enum(["starter", "pro"])
});

export const changePlanSchema = z.object({
  plan: z.enum(["starter", "pro"])
});
