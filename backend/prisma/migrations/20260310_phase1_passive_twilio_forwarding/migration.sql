-- Phase 1 passive Twilio forwarding layer
ALTER TABLE "CallLog"
  ADD COLUMN "parentCallSid" TEXT,
  ADD COLUMN "accountSid" TEXT,
  ADD COLUMN "forwardedToNumber" TEXT,
  ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'inbound',
  ADD COLUMN "initialWebhookAt" TIMESTAMP(3),
  ADD COLUMN "answeredAt" TIMESTAMP(3),
  ADD COLUMN "callStatus" TEXT,
  ADD COLUMN "dialCallStatus" TEXT,
  ADD COLUMN "answeredBy" TEXT,
  ADD COLUMN "missedReason" TEXT,
  ADD COLUMN "rawStatusPayload" JSONB,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'twilio';

CREATE INDEX IF NOT EXISTS "CallLog_orgId_idx" ON "CallLog"("orgId");
CREATE INDEX IF NOT EXISTS "CallLog_providerCallId_idx" ON "CallLog"("providerCallId");
CREATE INDEX IF NOT EXISTS "CallLog_fromNumber_idx" ON "CallLog"("fromNumber");
CREATE INDEX IF NOT EXISTS "CallLog_createdAt_idx" ON "CallLog"("createdAt");

ALTER TABLE "BusinessSettings"
  ADD COLUMN "voiceRoutingMode" TEXT NOT NULL DEFAULT 'AI_FIRST',
  ADD COLUMN "voiceForwardingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voiceForwardingNumber" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "voiceRingTimeoutSeconds" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "afterHoursVoiceFallbackEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voiceCallRecordingEnabled" BOOLEAN NOT NULL DEFAULT false;
