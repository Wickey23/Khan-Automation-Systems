-- Persist lightweight entity working memory for AI coordination.
CREATE TABLE "AgentEntityMemory" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "latestSummary" TEXT,
  "latestClassification" TEXT,
  "latestRecommendation" TEXT,
  "recommendationWhy" TEXT,
  "recommendationPriority" TEXT,
  "approvalNeeded" BOOLEAN NOT NULL DEFAULT false,
  "outboundBlocked" BOOLEAN NOT NULL DEFAULT false,
  "lastApprovalStatus" TEXT,
  "lastDeliveryStatus" TEXT,
  "lastTaskStatus" TEXT,
  "riskFlagsJson" JSONB NOT NULL DEFAULT '[]',
  "contextJson" JSONB NOT NULL DEFAULT '{}',
  "updatedByRunId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentEntityMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentEntityMemory_orgId_entityType_entityId_key"
  ON "AgentEntityMemory"("orgId", "entityType", "entityId");

CREATE INDEX "AgentEntityMemory_orgId_updatedAt_idx"
  ON "AgentEntityMemory"("orgId", "updatedAt");

CREATE INDEX "AgentEntityMemory_orgId_entityType_updatedAt_idx"
  ON "AgentEntityMemory"("orgId", "entityType", "updatedAt");

ALTER TABLE "AgentEntityMemory"
  ADD CONSTRAINT "AgentEntityMemory_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
