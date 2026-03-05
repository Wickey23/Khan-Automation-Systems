import "dotenv/config";
import { prisma } from "../src/lib/prisma";

type CheckResult = {
  key: string;
  ok: boolean;
  message?: string;
};

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function columnExists(tableName: string, columnName: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

function push(results: CheckResult[], key: string, ok: boolean, message?: string) {
  results.push({ key, ok, message });
}

async function run() {
  const results: CheckResult[] = [];

  const requiredTables = [
    "Appointment",
    "AppointmentHold",
    "CalendarConnection",
    "OrgNotification",
    "CallClassificationLog"
  ];

  for (const tableName of requiredTables) {
    push(results, `table:${tableName}`, await tableExists(tableName));
  }

  const requiredColumns: Array<{ table: string; column: string }> = [
    { table: "Lead", column: "pipelineStage" },
    { table: "Lead", column: "sourceCallLogId" },
    { table: "Lead", column: "qualified" },
    { table: "Lead", column: "classification" },
    { table: "Lead", column: "classificationConfidence" },
    { table: "BusinessSettings", column: "averageJobValueUsd" },
    { table: "BusinessSettings", column: "notificationEmailRecipientsJson" },
    { table: "BusinessSettings", column: "notificationTogglesJson" },
    { table: "BusinessSettings", column: "classificationShadowMode" },
    { table: "BusinessSettings", column: "classificationLlmDailyCap" },
    { table: "BusinessSettings", column: "appointmentDurationMinutes" },
    { table: "BusinessSettings", column: "appointmentBufferMinutes" },
    { table: "BusinessSettings", column: "bookingLeadTimeHours" },
    { table: "BusinessSettings", column: "bookingMaxDaysAhead" }
  ];

  for (const check of requiredColumns) {
    push(
      results,
      `column:${check.table}.${check.column}`,
      await columnExists(check.table, check.column)
    );
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  // eslint-disable-next-line no-console
  console.log(`Phase 1 schema check: ${passed} passed, ${failed.length} failed`);
  for (const row of results) {
    // eslint-disable-next-line no-console
    console.log(`[${row.ok ? "PASS" : "FAIL"}] ${row.key}${row.message ? ` - ${row.message}` : ""}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`Phase 1 schema check failed to run: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
