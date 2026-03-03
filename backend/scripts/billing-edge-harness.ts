import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getArg(name: string, fallback = "") {
  const key = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(key));
  return arg ? arg.slice(key.length) : fallback;
}

async function main() {
  const orgId = getArg("orgId");
  const sinceDays = Number.parseInt(getArg("sinceDays", "30"), 10);
  const since = new Date(Date.now() - Math.max(1, sinceDays) * 24 * 60 * 60 * 1000);

  const whereOrg = orgId ? { orgId } : {};

  const [billingEvents, activeSubs, inactiveSubs, failedProSms] = await Promise.all([
    prisma.billingWebhookEvent.findMany({
      where: { createdAt: { gte: since }, ...whereOrg },
      select: {
        id: true,
        eventId: true,
        eventType: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        processed: true,
        processingError: true,
        createdAt: true,
        orgId: true
      }
    }),
    prisma.subscription.findMany({
      where: { createdAt: { gte: since }, status: { in: ["active", "trialing"] }, ...whereOrg },
      select: { orgId: true, stripeSubscriptionId: true, status: true, plan: true, createdAt: true }
    }),
    prisma.subscription.findMany({
      where: { createdAt: { gte: since }, status: { in: ["past_due", "unpaid", "incomplete", "canceled"] }, ...whereOrg },
      select: { orgId: true, status: true, plan: true, createdAt: true }
    }),
    prisma.message.findMany({
      where: {
        createdAt: { gte: since },
        direction: "OUTBOUND",
        provider: "TWILIO",
        metadataJson: { contains: "\"feature\":\"pro_sms\"" }
      },
      select: { id: true, orgId: true, status: true, createdAt: true }
    })
  ]);

  const eventIdCounts = new Map<string, number>();
  for (const event of billingEvents) {
    const key = String(event.eventId || "");
    if (!key) continue;
    eventIdCounts.set(key, (eventIdCounts.get(key) || 0) + 1);
  }
  const duplicateEventIds = [...eventIdCounts.entries()].filter(([, count]) => count > 1);
  const unprocessed = billingEvents.filter((event) => !event.processed);
  const errored = billingEvents.filter((event) => Boolean(event.processingError));

  const summary = {
    scope: orgId || "all_orgs",
    windowStart: since.toISOString(),
    totals: {
      webhookEvents: billingEvents.length,
      duplicateEventIds: duplicateEventIds.length,
      unprocessedEvents: unprocessed.length,
      erroredEvents: errored.length,
      activeOrTrialingSubscriptions: activeSubs.length,
      inactiveSubscriptions: inactiveSubs.length,
      proSmsEventsDuringWindow: failedProSms.length
    },
    sample: {
      duplicateEventIds: duplicateEventIds.slice(0, 10),
      unprocessedEvents: unprocessed.slice(0, 10),
      erroredEvents: errored.slice(0, 10)
    }
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

void main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
