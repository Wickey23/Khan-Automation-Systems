import { LeadSource, type PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";

function normalizePhone(input: string) {
  const raw = String(input || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return `+${digits}`;
  return `+${digits}`;
}

function appendTag(existing: string, tag: string) {
  const parts = existing
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!parts.includes(tag)) parts.push(tag);
  return parts.join(", ");
}

export async function upsertDemoOverCapLead(input: {
  prismaClient?: PrismaClient;
  orgId: string;
  callerPhone: string;
  businessName: string;
  now?: Date;
}) {
  const prismaClient = input.prismaClient || prisma;
  const now = input.now || new Date();
  const phone = normalizePhone(input.callerPhone);
  if (!phone) return null;

  const existing = await prismaClient.lead.findFirst({
    where: { orgId: input.orgId, phone },
    orderBy: { createdAt: "desc" }
  });

  const marker = `DEMO_OVER_CAP|aiHandled=false|at=${now.toISOString()}`;

  if (existing) {
    const updated = await prismaClient.lead.update({
      where: { id: existing.id },
      data: {
        source: LeadSource.PHONE_CALL,
        tags: appendTag(existing.tags || "", "DEMO_OVER_CAP"),
        notes: existing.notes ? `${existing.notes}\n${marker}` : marker,
        message: existing.message || "Caller reached guided demo cap; callback requested."
      }
    });
    return updated;
  }

  const created = await prismaClient.lead.create({
    data: {
      orgId: input.orgId,
      name: "Unknown Caller",
      business: input.businessName,
      email: `${phone.replace(/\D/g, "")}@no-email.local`,
      phone,
      source: LeadSource.PHONE_CALL,
      message: "Caller reached guided demo cap; callback requested.",
      tags: "DEMO_OVER_CAP",
      notes: marker
    }
  });
  return created;
}
