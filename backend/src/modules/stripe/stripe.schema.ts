import { z } from "zod";

export const createCheckoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
  includeSetupFee: z.boolean().optional().default(false)
});
