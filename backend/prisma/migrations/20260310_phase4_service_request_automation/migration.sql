ALTER TABLE "BusinessSettings"
ADD COLUMN "serviceRequestAutomationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "serviceRequestFollowupSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "serviceRequestInternalAlertsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ServiceRequest" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "callLogId" TEXT NOT NULL,
  "leadId" TEXT,
  "customerName" TEXT,
  "phone" TEXT NOT NULL,
  "serviceType" TEXT,
  "urgency" TEXT,
  "serviceAddress" TEXT,
  "appointmentRequested" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "assignedTo" TEXT,
  "followUpSentAt" TIMESTAMP(3),
  "automationMetadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceRequest_callLogId_key" ON "ServiceRequest"("callLogId");
CREATE INDEX "ServiceRequest_orgId_createdAt_idx" ON "ServiceRequest"("orgId", "createdAt");
CREATE INDEX "ServiceRequest_callLogId_idx" ON "ServiceRequest"("callLogId");
CREATE INDEX "ServiceRequest_leadId_idx" ON "ServiceRequest"("leadId");
CREATE INDEX "ServiceRequest_status_createdAt_idx" ON "ServiceRequest"("status", "createdAt");

ALTER TABLE "ServiceRequest"
ADD CONSTRAINT "ServiceRequest_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRequest"
ADD CONSTRAINT "ServiceRequest_callLogId_fkey"
FOREIGN KEY ("callLogId") REFERENCES "CallLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRequest"
ADD CONSTRAINT "ServiceRequest_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
