import type { BusinessSettings, PrismaClient } from "@prisma/client";
import { decryptField } from "../../lib/crypto-fields";
import { normalizePhoneForLookup } from "./phone-number-normalizer";
import type { VoiceRoutingMode } from "./voice-routing-mode";

export type ResolvedVoiceRouting = {
  orgId: string;
  phoneNumberId: string;
  organization: {
    id: string;
    name: string;
    live: boolean;
    status: string;
    subscriptionStatus: string | null;
    businessSettings: BusinessSettings | null;
    aiAgentConfigs?: Array<{
      id: string;
      vapiAgentId: string | null;
      vapiPhoneNumberId: string | null;
      updatedAt: Date;
    }>;
  };
  businessSettings: BusinessSettings | null;
  voiceRoutingMode: VoiceRoutingMode;
  forwardingNumber: string;
  ringTimeoutSeconds: number;
  passiveForwardingValid: boolean;
} | null;

export async function resolveBusinessVoiceRouting(input: {
  prisma: PrismaClient;
  calledNumber: string;
  defaultRingTimeoutSeconds: number;
}) {
  const lookup = normalizePhoneForLookup(input.calledNumber);
  let phone = await input.prisma.phoneNumber.findFirst({
    where: {
      status: { not: "RELEASED" },
      OR: [
        { e164Number: lookup.raw },
        ...(lookup.normalized ? [{ e164Number: lookup.normalized }] : []),
        ...(lookup.last10.length === 10 ? [{ e164Number: { endsWith: lookup.last10 } }] : [])
      ]
    },
    include: {
      organization: {
        include: {
          aiAgentConfigs: { orderBy: { updatedAt: "desc" }, take: 1 },
          businessSettings: true
        }
      }
    }
  });

  if (!phone && lookup.normalized) {
    const active = await input.prisma.phoneNumber.findMany({
      where: { status: { not: "RELEASED" } },
      include: {
        organization: {
          include: {
            aiAgentConfigs: { orderBy: { updatedAt: "desc" }, take: 1 },
            businessSettings: true
          }
        }
      },
      take: 500
    });
    phone =
      active.find((row) => normalizePhoneForLookup(row.e164Number).normalized === lookup.normalized) ||
      (lookup.last10.length === 10
        ? active.find((row) => normalizePhoneForLookup(row.e164Number).last10 === lookup.last10)
        : null) ||
      null;
  }

  if (!phone?.organization) return null;

  const settings = phone.organization.businessSettings;
  const voiceRoutingMode = (settings?.voiceRoutingMode || "AI_FIRST") as VoiceRoutingMode;
  const forwardingNumber = decryptField(String(settings?.voiceForwardingNumber || "")).trim();
  const ringTimeoutSeconds = Math.max(
    5,
    Math.min(60, Number(settings?.voiceRingTimeoutSeconds || input.defaultRingTimeoutSeconds || 20) || 20)
  );
  const passiveForwardingValid = Boolean(settings?.voiceForwardingEnabled) && Boolean(forwardingNumber);

  return {
    orgId: phone.orgId,
    phoneNumberId: phone.id,
    organization: phone.organization,
    businessSettings: settings,
    voiceRoutingMode,
    forwardingNumber,
    ringTimeoutSeconds,
    passiveForwardingValid
  } satisfies ResolvedVoiceRouting;
}
