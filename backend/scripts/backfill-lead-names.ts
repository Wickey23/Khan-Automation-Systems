import "dotenv/config";
import { prisma } from "../src/lib/prisma";

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
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

function extractCallerName(text: string) {
  const source = String(text || "").trim();
  if (!source) return "";

  const stopWords = new Set([
    "sorry",
    "help",
    "issue",
    "problem",
    "phone",
    "number",
    "looking",
    "escalating",
    "customer",
    "caller",
    "unknown",
    "support",
    "service",
    "name",
    "from"
  ]);

  const patterns = [
    /\bmy name is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bthis is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bi(?:'m| am)\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,1})\b/i,
    /\b([A-Za-z][A-Za-z'-]+\s+[A-Za-z][A-Za-z'-]+)\s+called\b/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    const raw = match?.[1]?.trim() || "";
    if (!raw) continue;

    const cleaned = raw
      .replace(/\b(from|and|but)\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;

    const parts = cleaned.split(" ").filter(Boolean);
    if (!parts.length || parts.length > 3) continue;
    if (parts.some((part) => stopWords.has(part.toLowerCase()))) continue;
    if (parts.length === 1 && parts[0].length < 2) continue;

    return toTitleCase(parts.join(" "));
  }

  return "";
}

async function main() {
  const { orgId, limit, dryRun } = parseArgs();

  const leads = await prisma.lead.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      OR: [{ name: "Unknown Caller" }, { name: "" }]
    },
    orderBy: { updatedAt: "desc" },
    take: Number.isFinite(limit) ? limit : 500,
    select: { id: true, orgId: true, name: true, phone: true }
  });

  let scanned = 0;
  let renamed = 0;
  let skipped = 0;

  for (const lead of leads) {
    scanned += 1;
    if (!lead.orgId || !lead.phone) {
      skipped += 1;
      continue;
    }

    const calls = await prisma.callLog.findMany({
      where: { orgId: lead.orgId, leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { transcript: true, aiSummary: true }
    });

    let candidate = "";
    for (const call of calls) {
      candidate = extractCallerName(call.transcript || call.aiSummary || "");
      if (candidate) break;
    }

    if (!candidate) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      renamed += 1;
      continue;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { name: candidate }
    });
    renamed += 1;
  }

  console.log(
    JSON.stringify(
      {
        orgId: orgId || null,
        scanned,
        renamed,
        skipped,
        dryRun
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

