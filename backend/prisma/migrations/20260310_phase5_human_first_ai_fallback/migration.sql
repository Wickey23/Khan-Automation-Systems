-- AlterTable
ALTER TABLE "CallLog"
ADD COLUMN "voiceRoutingMode" TEXT,
ADD COLUMN "aiFallbackInvoked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aiFallbackInvokedAt" TIMESTAMP(3),
ADD COLUMN "humanAttemptDialStatus" TEXT;
