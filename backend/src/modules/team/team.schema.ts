import { z } from "zod";

export const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "manager", "viewer"])
});

export const acceptTeamInviteSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

export const updateTeamRoleSchema = z.object({
  membershipId: z.string().min(5),
  role: z.enum(["admin", "manager", "viewer"])
});

export const deleteTeamMemberSchema = z.object({
  membershipId: z.string().min(5)
});

export const resendTeamInviteSchema = z.object({
  membershipId: z.string().min(5)
});
