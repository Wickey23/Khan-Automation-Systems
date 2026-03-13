-- CreateEnum
CREATE TYPE "OutreachPhoneEventType" AS ENUM ('QUEUED', 'STARTED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "OutreachCallerConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "vapiAssistantId" TEXT,
    "vapiPhoneNumberId" TEXT,
    "twilioFromNumber" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "windowStartHour" INTEGER NOT NULL DEFAULT 9,
    "windowEndHour" INTEGER NOT NULL DEFAULT 17,
    "maxCallsPerDay" INTEGER NOT NULL DEFAULT 20,
    "prompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachCallerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachPhoneEnrollment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "callerConfigId" TEXT NOT NULL,
    "nextCallAt" TIMESTAMP(3),
    "status" "OutreachEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "stopReason" TEXT,
    "lastCalledAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "processingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachPhoneEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachPhoneEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "enrollmentId" TEXT,
    "callerConfigId" TEXT,
    "provider" TEXT NOT NULL,
    "providerCallId" TEXT,
    "eventType" "OutreachPhoneEventType" NOT NULL,
    "toPhone" TEXT NOT NULL,
    "fromPhone" TEXT,
    "status" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachPhoneEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachCallerConfig_orgId_name_key" ON "OutreachCallerConfig"("orgId", "name");
CREATE INDEX "OutreachCallerConfig_orgId_isActive_createdAt_idx" ON "OutreachCallerConfig"("orgId", "isActive", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OutreachPhoneEnrollment_orgId_status_nextCallAt_idx" ON "OutreachPhoneEnrollment"("orgId", "status", "nextCallAt");
CREATE INDEX "OutreachPhoneEnrollment_orgId_leadId_idx" ON "OutreachPhoneEnrollment"("orgId", "leadId");
CREATE INDEX "OutreachPhoneEnrollment_orgId_callerConfigId_idx" ON "OutreachPhoneEnrollment"("orgId", "callerConfigId");
CREATE INDEX "OutreachPhoneEnrollment_orgId_processingStartedAt_idx" ON "OutreachPhoneEnrollment"("orgId", "processingStartedAt");
CREATE UNIQUE INDEX "OutreachPhoneEnrollment_active_unique_idx" ON "OutreachPhoneEnrollment"("orgId", "leadId", "callerConfigId") WHERE "status" IN ('ACTIVE', 'PAUSED');

-- CreateIndex
CREATE INDEX "OutreachPhoneEvent_orgId_eventType_createdAt_idx" ON "OutreachPhoneEvent"("orgId", "eventType", "createdAt" DESC);
CREATE INDEX "OutreachPhoneEvent_orgId_leadId_createdAt_idx" ON "OutreachPhoneEvent"("orgId", "leadId", "createdAt" DESC);
CREATE INDEX "OutreachPhoneEvent_orgId_enrollmentId_createdAt_idx" ON "OutreachPhoneEvent"("orgId", "enrollmentId", "createdAt" DESC);
CREATE INDEX "OutreachPhoneEvent_orgId_callerConfigId_createdAt_idx" ON "OutreachPhoneEvent"("orgId", "callerConfigId", "createdAt" DESC);
CREATE INDEX "OutreachPhoneEvent_orgId_providerCallId_idx" ON "OutreachPhoneEvent"("orgId", "providerCallId");

-- AddForeignKey
ALTER TABLE "OutreachCallerConfig" ADD CONSTRAINT "OutreachCallerConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachPhoneEnrollment" ADD CONSTRAINT "OutreachPhoneEnrollment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachPhoneEnrollment" ADD CONSTRAINT "OutreachPhoneEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "OutreachLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachPhoneEnrollment" ADD CONSTRAINT "OutreachPhoneEnrollment_callerConfigId_fkey" FOREIGN KEY ("callerConfigId") REFERENCES "OutreachCallerConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachPhoneEvent" ADD CONSTRAINT "OutreachPhoneEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachPhoneEvent" ADD CONSTRAINT "OutreachPhoneEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "OutreachLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachPhoneEvent" ADD CONSTRAINT "OutreachPhoneEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "OutreachPhoneEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachPhoneEvent" ADD CONSTRAINT "OutreachPhoneEvent_callerConfigId_fkey" FOREIGN KEY ("callerConfigId") REFERENCES "OutreachCallerConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
