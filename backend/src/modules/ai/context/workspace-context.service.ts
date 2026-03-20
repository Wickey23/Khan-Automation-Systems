import { prisma } from "../../../lib/prisma";

export type WorkspaceContext = {
  orgId: string;
  organizationName: string;
  timezone: string;
  businessHoursJson: string | null;
  servicesJson: string | null;
  transferNumbersJson: string | null;
  smsConsentCopy: string | null;
  callVolume7d: number;
  messageVolume7d: number;
  bookingDemand7d: number;
};

export async function buildWorkspaceContext(orgId: string): Promise<WorkspaceContext> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [org, settings, callVolume7d, messageVolume7d, bookingDemand7d] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.businessSettings.findUnique({
      where: { orgId },
      select: {
        timezone: true,
        hoursJson: true,
        servicesJson: true,
        transferNumbersJson: true,
        smsConsentText: true
      }
    }),
    prisma.callLog.count({ where: { orgId, createdAt: { gte: since } } }),
    prisma.message.count({ where: { orgId, createdAt: { gte: since } } }),
    prisma.appointmentRequest.count({ where: { orgId, createdAt: { gte: since } } })
  ]);

  return {
    orgId,
    organizationName: org?.name || "Workspace",
    timezone: settings?.timezone || "America/New_York",
    businessHoursJson: settings?.hoursJson || null,
    servicesJson: settings?.servicesJson || null,
    transferNumbersJson: settings?.transferNumbersJson || null,
    smsConsentCopy: settings?.smsConsentText || null,
    callVolume7d,
    messageVolume7d,
    bookingDemand7d
  };
}
