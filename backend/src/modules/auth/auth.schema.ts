import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const signupSchema = z.object({
  name: z.string().min(2),
  business: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  industry: z.string().optional()
});
