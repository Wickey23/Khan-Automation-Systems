-- Add delivery execution fields to AI approval requests.
ALTER TABLE "ApprovalRequest"
  ADD COLUMN "approvedSubject" TEXT,
  ADD COLUMN "approvedContent" TEXT,
  ADD COLUMN "deliveryChannel" TEXT,
  ADD COLUMN "deliveryStatus" TEXT,
  ADD COLUMN "deliveryProvider" TEXT,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "deliveryMetadata" JSONB,
  ADD COLUMN "deliveryAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "retryable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ApprovalRequest_orgId_deliveryStatus_createdAt_idx"
  ON "ApprovalRequest"("orgId", "deliveryStatus", "createdAt");
