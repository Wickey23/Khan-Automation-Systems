import { OrganizationStatus } from "@prisma/client";

export function deriveOrgLifecycleFromBilling(input: {
  currentStatus: OrganizationStatus;
  currentLive: boolean;
  billingActive: boolean;
}) {
  if (!input.billingActive) {
    return {
      status: OrganizationStatus.PAUSED,
      live: false
    };
  }

  if (input.currentLive || input.currentStatus === OrganizationStatus.LIVE) {
    return {
      status: OrganizationStatus.LIVE,
      live: true
    };
  }

  return {
    status: OrganizationStatus.ONBOARDING,
    live: input.currentLive
  };
}
