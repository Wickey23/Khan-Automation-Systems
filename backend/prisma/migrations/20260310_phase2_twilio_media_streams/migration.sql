ALTER TABLE "BusinessSettings"
ADD COLUMN "voiceMediaStreamingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "voiceMediaTrackStrategy" TEXT NOT NULL DEFAULT 'BOTH_TRACKS';

ALTER TABLE "CallLog"
ADD COLUMN "hasMediaStream" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "latestStreamStatus" TEXT;

CREATE TABLE "CallMediaStreamSession" (
  "id" TEXT NOT NULL,
  "callLogId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'twilio',
  "streamSid" TEXT,
  "callSid" TEXT NOT NULL,
  "parentCallSid" TEXT,
  "streamName" TEXT,
  "trackStrategy" TEXT NOT NULL,
  "streamStatus" TEXT NOT NULL,
  "websocketConnectedAt" TIMESTAMP(3),
  "mediaStartedAt" TIMESTAMP(3),
  "mediaEndedAt" TIMESTAMP(3),
  "lastMediaAt" TIMESTAMP(3),
  "stopReason" TEXT,
  "streamMetadata" JSONB,
  "customParametersJson" JSONB,
  "startPayloadJson" JSONB,
  "stopPayloadJson" JSONB,
  "lastSequenceNumber" INTEGER,
  "mediaEventCount" INTEGER NOT NULL DEFAULT 0,
  "inboundChunkCount" INTEGER NOT NULL DEFAULT 0,
  "outboundChunkCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallMediaStreamSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CallMediaStreamSession_streamSid_key" ON "CallMediaStreamSession"("streamSid");
CREATE INDEX "CallMediaStreamSession_callLogId_idx" ON "CallMediaStreamSession"("callLogId");
CREATE INDEX "CallMediaStreamSession_orgId_createdAt_idx" ON "CallMediaStreamSession"("orgId", "createdAt");
CREATE INDEX "CallMediaStreamSession_streamSid_idx" ON "CallMediaStreamSession"("streamSid");
CREATE INDEX "CallMediaStreamSession_callSid_idx" ON "CallMediaStreamSession"("callSid");
CREATE INDEX "CallMediaStreamSession_streamStatus_createdAt_idx" ON "CallMediaStreamSession"("streamStatus", "createdAt");

ALTER TABLE "CallMediaStreamSession"
ADD CONSTRAINT "CallMediaStreamSession_callLogId_fkey"
FOREIGN KEY ("callLogId") REFERENCES "CallLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallMediaStreamSession"
ADD CONSTRAINT "CallMediaStreamSession_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
