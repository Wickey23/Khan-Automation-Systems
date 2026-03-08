import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const verifyLoginOtpSchema = z.object({
  email: z.string().email(),
  challengeId: z.string().min(10),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits.")
});

export const resendLoginOtpSchema = z.object({
  email: z.string().email(),
  challengeId: z.string().min(10)
});

export const signupSchema = z.object({
  name: z.string().min(2),
  businessName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  industry: z.string().optional()
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

export const stepUpSchema = z.object({
  password: z.string().min(8)
});
