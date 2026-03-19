import { z } from "zod";

// RFC 5321 caps local part at 64 chars + domain at 255 chars = 320 total.
// Passwords are capped at 1024 chars to prevent bcrypt CPU-amplification attacks
// (bcrypt is O(n) in password length; multi-MB inputs can spike a CPU core for seconds).
const emailField = z.string().email().max(320);
const passwordFieldMin8 = z.string().min(8).max(1024);

export const loginSchema = z.object({
  email: emailField,
  password: passwordFieldMin8
});

export const verifyLoginOtpSchema = z.object({
  email: emailField,
  challengeId: z.string().min(10).max(128),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits.")
});

export const resendLoginOtpSchema = z.object({
  email: emailField,
  challengeId: z.string().min(10).max(128)
});

export const signupSchema = z.object({
  name: z.string().min(2).max(200),
  businessName: z.string().min(2).max(200),
  email: emailField,
  password: passwordFieldMin8,
  industry: z.string().max(100).optional()
});

export const forgotPasswordSchema = z.object({
  email: emailField
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(512),
  password: passwordFieldMin8
});

export const stepUpSchema = z.object({
  password: passwordFieldMin8
});
