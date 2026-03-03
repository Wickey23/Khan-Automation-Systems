import "dotenv/config";
import { LeadSource } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return input.trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (input.trim().startsWith("+")) return input.trim();
  return `+${digits}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { orgId?: string; limit?: number; dryRun: boolean } = { dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const val = args[i + 1];
    if (key === "--orgId" && val) out.orgId = val;
    if (key === "--limit" && val) out.limit = Number.parseInt(val, 10);
    if (key === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function main() {
  const { orgId, limit, dryRun } = parseArgs();

  const calls = await prisma.callLog.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      leadId: null,
      fromNumber: { not: "unknown" }
    },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) ? limit : 500,
    select: {
      id: true,
      orgId: true,
      fromNumber: true,
      aiSummary: true,
      transcript: true,
      createdAt: true
    }
  });

  let created = 0;
  let updated = 0;
  let linked = 0;
  let skipped = 0;

  for (const call of calls) {
    const phone = normalizePhone(call.fromNumber || "");
    if (!phone || phone === "unknown") {
      skipped += 1;
      continue;
    }

    const org = await prisma.organization.findUnique({
      where: { id: call.orgId },
      select: { id: true, name: true }
    });
    if (!org) {
      skipped += 1;
      continue;
    }

    const existingLead = await prisma.lead.findFirst({
      where: { orgId: call.orgId, phone },
      orderBy: { createdAt: "desc" }
    });
    const fallbackMessage = (call.aiSummary || call.transcript || "").trim();
    const fallbackEmail = `${phone.replace(/\D/g, "") || "unknown"}@no-email.local`;

    if (dryRun) {
      if (!existingLead) created += 1;
      else updated += 1;
      linked += 1;
      continue;
    }

    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            message: fallbackMessage || existingLead.message,
            business: existingLead.business || org.name,
            email: existingLead.email || fallbackEmail
          }
        })
      : await prisma.lead.create({
          data: {
            orgId: call.orgId,
            name: "Unknown Caller",
            business: org.name,
            email: fallbackEmail,
            phone,
            message: fallbackMessage,
            source: LeadSource.PHONE_CALL
          }
        });

    if (existingLead) updated += 1;
    else created += 1;

    const linkResult = await prisma.callLog.updateMany({
      where: { id: call.id, orgId: call.orgId, leadId: null },
      data: { leadId: lead.id }
    });
    if (linkResult.count > 0) linked += 1;
  }

  console.log(
    JSON.stringify(
      {
        scanned: calls.length,
        created,
        updated,
        linked,
        skipped,
        dryRun,
        orgId: orgId || null
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

