import { Prisma, type PrismaClient } from "@prisma/client";
import { env } from "../../config/env";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function asPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const GUIDED_DEMO_WINDOW_DAYS = asPositiveInt(env.GUIDED_DEMO_WINDOW_DAYS, 7);
export const GUIDED_DEMO_TOTAL_CALL_CAP = asPositiveInt(env.GUIDED_DEMO_TOTAL_CALL_CAP, 15);

export type GuidedDemoState = "ACTIVE" | "OVER_CAP" | "EXPIRED" | "NOT_ELIGIBLE";

export type GuidedDemoStatus = {
  mode: "GUIDED_DEMO" | null;
  state: GuidedDemoState;
  eligible: boolean;
  windowEndsAt: string | null;
  callCap: number;
  callsUsed: number;
  callsRemaining: number;
  overLimit: boolean;
};

export type GetDemoStateInput = {
  prisma: PrismaClient;
  orgId: string | null | undefined;
  subscriptionStatus?: string | null;
  now?: Date;
  allowStart?: boolean;
  providerCallId?: string | null;
};

export function isGuidedDemoEnabled() {
  return env.GUIDED_DEMO_ENABLED === "true";
}

export function isPaidSubscriptionActive(status: string | null | undefined) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(String(status || "").toLowerCase());
}

function baseNotEligible(): GuidedDemoStatus {
  return {
    mode: null,
    state: "NOT_ELIGIBLE",
    eligible: false,
    windowEndsAt: null,
    callCap: GUIDED_DEMO_TOTAL_CALL_CAP,
    callsUsed: 0,
    callsRemaining: 0,
    overLimit: false
  };
}

async function countAttempts(prisma: PrismaClient, orgId: string, start: Date, end: Date) {
  return prisma.demoAiAttempt.count({
    where: {
      orgId,
      attemptedAt: {
        gte: start,
        lte: end
      }
    }
  });
}

export async function getDemoState(input: GetDemoStateInput): Promise<GuidedDemoStatus> {
  const now = input.now || new Date();
  const allowStart = Boolean(input.allowStart);
  const providerCallId = String(input.providerCallId || "").trim();

  if (!isGuidedDemoEnabled()) return baseNotEligible();
  if (!input.orgId) return baseNotEligible();
  if (isPaidSubscriptionActive(input.subscriptionStatus)) return baseNotEligible();

  let stateRow = await input.prisma.organizationDemoState.findUnique({
    where: { orgId: input.orgId },
    select: { demoStartedAt: true, demoEndsAt: true }
  });

  if (allowStart && (!stateRow?.demoStartedAt || !stateRow.demoEndsAt) && providerCallId) {
    const end = new Date(now.getTime() + GUIDED_DEMO_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    await input.prisma.organizationDemoState.upsert({
      where: { orgId: input.orgId },
      update: {
        demoStartedAt: now,
        demoEndsAt: end,
        startedByProviderCallId: providerCallId
      },
      create: {
        orgId: input.orgId,
        demoStartedAt: now,
        demoEndsAt: end,
        startedByProviderCallId: providerCallId
      }
    });
    stateRow = { demoStartedAt: now, demoEndsAt: end };
  }

  if (!stateRow?.demoStartedAt || !stateRow.demoEndsAt) {
    return {
      mode: "GUIDED_DEMO",
      state: "ACTIVE",
      eligible: true,
      windowEndsAt: null,
      callCap: GUIDED_DEMO_TOTAL_CALL_CAP,
      callsUsed: 0,
      callsRemaining: GUIDED_DEMO_TOTAL_CALL_CAP,
      overLimit: false
    };
  }

  const callsUsed = await countAttempts(input.prisma, input.orgId, stateRow.demoStartedAt, stateRow.demoEndsAt);
  const callsRemaining = Math.max(0, GUIDED_DEMO_TOTAL_CALL_CAP - callsUsed);
  const overLimit = callsUsed >= GUIDED_DEMO_TOTAL_CALL_CAP;

  if (now.getTime() > stateRow.demoEndsAt.getTime()) {
    return {
      mode: "GUIDED_DEMO",
      state: "EXPIRED",
      eligible: true,
      windowEndsAt: stateRow.demoEndsAt.toISOString(),
      callCap: GUIDED_DEMO_TOTAL_CALL_CAP,
      callsUsed,
      callsRemaining,
      overLimit
    };
  }

  return {
    mode: "GUIDED_DEMO",
    state: overLimit ? "OVER_CAP" : "ACTIVE",
    eligible: true,
    windowEndsAt: stateRow.demoEndsAt.toISOString(),
    callCap: GUIDED_DEMO_TOTAL_CALL_CAP,
    callsUsed,
    callsRemaining,
    overLimit
  };
}

export type ReserveDemoAttemptInput = {
  prisma: PrismaClient;
  orgId: string;
  providerCallId: string;
  callerPhone?: string | null;
  now?: Date;
};

export type ReserveDemoAttemptResult =
  | { allowed: true; demo: GuidedDemoStatus }
  | {
      allowed: false;
      reason: "OVER_CAP" | "EXPIRED" | "NOT_ELIGIBLE";
      demo: GuidedDemoStatus;
    };

export async function reserveDemoAttemptOrReject(input: ReserveDemoAttemptInput): Promise<ReserveDemoAttemptResult> {
  const now = input.now || new Date();
  const providerCallId = String(input.providerCallId || "").trim();
  if (!providerCallId) {
    return {
      allowed: false,
      reason: "NOT_ELIGIBLE",
      demo: baseNotEligible()
    };
  }

  const result = await input.prisma.$transaction(
    async (tx) => {
      const existing = await tx.organizationDemoState.findUnique({
        where: { orgId: input.orgId },
        select: { demoStartedAt: true, demoEndsAt: true }
      });

      const startAt = existing?.demoStartedAt || now;
      const endAt = existing?.demoEndsAt || new Date(now.getTime() + GUIDED_DEMO_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      if (!existing?.demoStartedAt || !existing?.demoEndsAt) {
        await tx.organizationDemoState.upsert({
          where: { orgId: input.orgId },
          update: {
            demoStartedAt: startAt,
            demoEndsAt: endAt,
            startedByProviderCallId: providerCallId
          },
          create: {
            orgId: input.orgId,
            demoStartedAt: startAt,
            demoEndsAt: endAt,
            startedByProviderCallId: providerCallId
          }
        });
      }

      if (now.getTime() > endAt.getTime()) {
        const callsUsed = await tx.demoAiAttempt.count({
          where: { orgId: input.orgId, attemptedAt: { gte: startAt, lte: endAt } }
        });
        return {
          allowed: false as const,
          reason: "EXPIRED" as const,
          demo: {
            mode: "GUIDED_DEMO" as const,
            state: "EXPIRED" as const,
            eligible: true,
            windowEndsAt: endAt.toISOString(),
            callCap: GUIDED_DEMO_TOTAL_CALL_CAP,
            callsUsed,
            callsRemaining: Math.max(0, GUIDED_DEMO_TOTAL_CALL_CAP - callsUsed),
            overLimit: callsUsed >= GUIDED_DEMO_TOTAL_CALL_CAP
          }
        };
      }

      try {
        await tx.demoAiAttempt.create({
          data: {
            orgId: input.orgId,
            providerCallId,
            callerPhone: input.callerPhone || null,
            attemptedAt: now
          }
        });
      } catch (error) {
        const maybeCode = (error as { code?: string } | null | undefined)?.code;
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) && maybeCode !== "P2002") {
          throw error;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code !== "P2002") {
          throw error;
        }
      }

      const callsUsed = await tx.demoAiAttempt.count({
        where: { orgId: input.orgId, attemptedAt: { gte: startAt, lte: endAt } }
      });
      const callsRemaining = Math.max(0, GUIDED_DEMO_TOTAL_CALL_CAP - callsUsed);
      const overLimit = callsUsed >= GUIDED_DEMO_TOTAL_CALL_CAP;
      const state: GuidedDemoState = overLimit ? "OVER_CAP" : "ACTIVE";
      if (callsUsed > GUIDED_DEMO_TOTAL_CALL_CAP) {
        return {
          allowed: false as const,
          reason: "OVER_CAP" as const,
          demo: {
            mode: "GUIDED_DEMO" as const,
            state: "OVER_CAP" as const,
            eligible: true,
            windowEndsAt: endAt.toISOString(),
            callCap: GUIDED_DEMO_TOTAL_CALL_CAP,
            callsUsed,
            callsRemaining,
            overLimit
          }
        };
      }

      return {
        allowed: true as const,
        demo: {
          mode: "GUIDED_DEMO" as const,
          state,
          eligible: true,
          windowEndsAt: endAt.toISOString(),
          callCap: GUIDED_DEMO_TOTAL_CALL_CAP,
          callsUsed,
          callsRemaining,
          overLimit
        }
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return result;
}
