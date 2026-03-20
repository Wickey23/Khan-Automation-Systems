import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";

function parseCsvRows(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, index) => {
      row[h] = cols[index] || "";
    });
    rows.push(row);
  }
  return rows;
}

function toNullable(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text ? text : null;
}

export const importWorker = new Worker(
  "import-processing",
  async (job: Job) => {
    const { jobId, orgId } = job.data;

    // Load the job record and its source data (PII durable storage)
    const jobRecord = await prisma.bulkImportJob.findUnique({
      where: { id: jobId }
    });

    if (!jobRecord || !jobRecord.sourceData) {
      throw new Error(`Import job ${jobId} not found or missing source data.`);
    }

    await prisma.bulkImportJob.update({
      where: { id: jobId },
      data: { 
        status: "PROCESSING", 
        startedAt: new Date(),
        attempts: { increment: 1 }
      }
    });

    const rows = parseCsvRows(jobRecord.sourceData);
    const startIndex = jobRecord.processedRows || 0;
    let successCount = jobRecord.successCount || 0;
    let failureCount = jobRecord.failureCount || 0;
    
    // Extract existing errors from metadata if resuming
    const metadata = (jobRecord.metadataJson as any) || {};
    const errors: string[] = metadata.errors || [];

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = startIndex; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (row, indexInBatch) => {
          const globalIndex = i + indexInBatch + 1;
          
          try {
            if (jobRecord.type === "PROSPECT") {
              if (!row.name || !row.business) {
                failureCount++;
                errors.push(`Row ${globalIndex}: Missing name or business`);
                return;
              }
              await prisma.prospect.create({
                data: {
                  orgId: orgId || null,
                  name: row.name,
                  business: row.business,
                  email: toNullable(row.email),
                  phone: toNullable(row.phone),
                  website: toNullable(row.website),
                  industry: toNullable(row.industry),
                  city: toNullable(row.city),
                  state: toNullable(row.state),
                  notes: toNullable(row.notes),
                  tags: row.tags || "",
                  source: "CSV_IMPORT",
                  status: "NEW"
                }
              });
            } else if (jobRecord.type === "OUTREACH_LEAD") {
              if (!row.email) {
                failureCount++;
                errors.push(`Row ${globalIndex}: Missing email`);
                return;
              }
              await prisma.outreachLead.create({
                data: {
                  orgId: orgId,
                  contactName: toNullable(row.name || row.contactname),
                  companyName: toNullable(row.company || row.companyname || row.business),
                  email: row.email.toLowerCase(),
                  phone: toNullable(row.phone),
                  city: toNullable(row.city),
                  state: toNullable(row.state),
                  industry: toNullable(row.industry),
                  website: toNullable(row.website),
                  notes: toNullable(row.notes),
                  angle: toNullable(row.angle),
                  painPoint: toNullable(row.painpoint),
                  offer: toNullable(row.offer),
                  sourceList: toNullable(row.sourcelist),
                  status: "NEW"
                }
              });
            } else {
              throw new Error(`Unsupported job type: ${jobRecord.type}`);
            }
            successCount++;
          } catch (err) {
            failureCount++;
            errors.push(`Row ${globalIndex}: ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        })
      );

      // Priority 3: Real-time progress update for operator visibility
      await prisma.bulkImportJob.update({
        where: { id: jobId },
        data: { 
          processedRows: successCount + failureCount,
          successCount,
          failureCount,
          metadataJson: {
            ...metadata,
            lastBatchAt: new Date(),
            partialErrors: errors.slice(-5) // Tiny tail for visibility
          }
        }
      });

      // Throttle slightly to reduce DB pressure
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const finalStatus = failureCount === rows.length ? "FAILED" : "COMPLETED";

    await prisma.bulkImportJob.update({
      where: { id: jobId },
      data: { 
        status: finalStatus,
        completedAt: new Date(),
        processedRows: successCount + failureCount,
        successCount,
        failureCount,
        metadataJson: {
          ...metadata,
          errors: errors.slice(0, 50) // Store limited error sample durably
        }
      }
    });

    console.log(`[ImportWorker] Job ${jobId} finished. Status: ${finalStatus}. S: ${successCount}, F: ${failureCount}`);
  },
  {
    connection: redis as any,
    concurrency: 2
  }
);
