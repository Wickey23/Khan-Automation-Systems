-- CreateEnum
CREATE TYPE "OutreachLeadStatus" AS ENUM ('NEW', 'ACTIVE', 'PAUSED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OutreachEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutreachEmailEventType" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'REPLIED', 'UNSUBSCRIBED');

-- CreateTable
CREATE TABLE "OutreachLead" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "status" "OutreachLeadStatus" NOT NULL DEFAULT 'NEW',
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSequence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "delayHours" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "bodyText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEnrollment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "currentStepNumber" INTEGER NOT NULL DEFAULT 1,
    "nextSendAt" TIMESTAMP(3),
    "status" "OutreachEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "stopReason" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEmailEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "enrollmentId" TEXT,
    "sequenceId" TEXT,
    "stepNumber" INTEGER,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "eventType" "OutreachEmailEventType" NOT NULL,
    "subject" TEXT,
    "toEmail" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachEmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSuppression" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutreachLead_orgId_status_createdAt_idx" ON "OutreachLead"("orgId", "status", "createdAt" DESC);
CREATE INDEX "OutreachLead_orgId_email_idx" ON "OutreachLead"("orgId", "email");
CREATE INDEX "OutreachLead_orgId_lastContactedAt_idx" ON "OutreachLead"("orgId", "lastContactedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachSequence_orgId_name_key" ON "OutreachSequence"("orgId", "name");
CREATE INDEX "OutreachSequence_orgId_isActive_createdAt_idx" ON "OutreachSequence"("orgId", "isActive", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachSequenceStep_sequenceId_stepNumber_key" ON "OutreachSequenceStep"("sequenceId", "stepNumber");
CREATE INDEX "OutreachSequenceStep_sequenceId_stepNumber_idx" ON "OutreachSequenceStep"("sequenceId", "stepNumber");

-- CreateIndex
CREATE INDEX "OutreachEnrollment_orgId_status_nextSendAt_idx" ON "OutreachEnrollment"("orgId", "status", "nextSendAt");
CREATE INDEX "OutreachEnrollment_orgId_leadId_idx" ON "OutreachEnrollment"("orgId", "leadId");
CREATE INDEX "OutreachEnrollment_orgId_sequenceId_idx" ON "OutreachEnrollment"("orgId", "sequenceId");
CREATE INDEX "OutreachEnrollment_orgId_processingStartedAt_idx" ON "OutreachEnrollment"("orgId", "processingStartedAt");
CREATE UNIQUE INDEX "OutreachEnrollment_active_unique_idx" ON "OutreachEnrollment"("orgId", "leadId", "sequenceId") WHERE "status" IN ('ACTIVE', 'PAUSED');

-- CreateIndex
CREATE INDEX "OutreachEmailEvent_orgId_eventType_createdAt_idx" ON "OutreachEmailEvent"("orgId", "eventType", "createdAt" DESC);
CREATE INDEX "OutreachEmailEvent_orgId_leadId_createdAt_idx" ON "OutreachEmailEvent"("orgId", "leadId", "createdAt" DESC);
CREATE INDEX "OutreachEmailEvent_orgId_enrollmentId_createdAt_idx" ON "OutreachEmailEvent"("orgId", "enrollmentId", "createdAt" DESC);
CREATE INDEX "OutreachEmailEvent_orgId_sequenceId_createdAt_idx" ON "OutreachEmailEvent"("orgId", "sequenceId", "createdAt" DESC);
CREATE INDEX "OutreachEmailEvent_orgId_providerMessageId_idx" ON "OutreachEmailEvent"("orgId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachSuppression_orgId_email_key" ON "OutreachSuppression"("orgId", "email");
CREATE INDEX "OutreachSuppression_orgId_createdAt_idx" ON "OutreachSuppression"("orgId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "OutreachLead" ADD CONSTRAINT "OutreachLead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachSequenceStep" ADD CONSTRAINT "OutreachSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachEnrollment" ADD CONSTRAINT "OutreachEnrollment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachEnrollment" ADD CONSTRAINT "OutreachEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "OutreachLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachEnrollment" ADD CONSTRAINT "OutreachEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachEmailEvent" ADD CONSTRAINT "OutreachEmailEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachEmailEvent" ADD CONSTRAINT "OutreachEmailEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "OutreachLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachEmailEvent" ADD CONSTRAINT "OutreachEmailEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "OutreachEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachEmailEvent" ADD CONSTRAINT "OutreachEmailEvent_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachSuppression" ADD CONSTRAINT "OutreachSuppression_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
