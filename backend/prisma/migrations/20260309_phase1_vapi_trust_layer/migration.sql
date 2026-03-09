ALTER TYPE "CallLogOutcome" ADD VALUE IF NOT EXISTS 'ABANDONED';

ALTER TABLE "CallLog"
ADD COLUMN "transferReason" TEXT,
ADD COLUMN "transferTarget" TEXT,
ADD COLUMN "durationBeforeTransferSec" INTEGER,
ADD COLUMN "unansweredTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recoverySmsSentAt" TIMESTAMP(3),
ADD COLUMN "recoverySmsResponse" TEXT,
ADD COLUMN "recoverySmsThreadId" TEXT;
