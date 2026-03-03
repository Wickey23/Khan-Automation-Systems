import type { PrismaClient } from "@prisma/client";

type ReplayInput = {
  provider: string;
  eventKey: string;
  orgId?: string | null;
  outcome?: string;
};

export async function registerWebhookReplay(prisma: PrismaClient, input: ReplayInput) {
  if (!input.eventKey) return { duplicate: false };
  const orgScope = input.orgId && input.orgId.trim() ? input.orgId.trim() : "__global__";
  try {
    await prisma.webhookReplayGuard.create({
      data: {
        provider: input.provider.toUpperCase(),
        eventKey: input.eventKey,
        orgId: orgScope,
        outcome: input.outcome || "ACCEPTED"
      }
    });
    return { duplicate: false };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "P2002") return { duplicate: true };
    throw error;
  }
}
