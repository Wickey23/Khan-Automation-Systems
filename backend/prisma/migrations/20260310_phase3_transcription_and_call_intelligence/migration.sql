ALTER TABLE "BusinessSettings"
ADD COLUMN "voiceTranscriptionEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CallLog"
ADD COLUMN "transcriptStatus" TEXT,
ADD COLUMN "transcriptGeneratedAt" TIMESTAMP(3),
ADD COLUMN "aiSummaryGeneratedAt" TIMESTAMP(3);

ALTER TABLE "Lead"
ADD COLUMN "appointmentRequested" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CallTranscriptSession" (
  "id" TEXT NOT NULL,
  "callLogId" TEXT NOT NULL,
  "streamSessionId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sessionStatus" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "providerMetadataJson" JSONB,
  "errorText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallTranscriptSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallTranscriptSegment" (
  "id" TEXT NOT NULL,
  "transcriptSessionId" TEXT NOT NULL,
  "callLogId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "streamSid" TEXT,
  "speaker" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "startTimeMs" INTEGER NOT NULL,
  "endTimeMs" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "isFinal" BOOLEAN NOT NULL,
  "providerSegmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallTranscriptSegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CallTranscriptSession_callLogId_idx" ON "CallTranscriptSession"("callLogId");
CREATE INDEX "CallTranscriptSession_streamSessionId_idx" ON "CallTranscriptSession"("streamSessionId");
CREATE INDEX "CallTranscriptSession_orgId_createdAt_idx" ON "CallTranscriptSession"("orgId", "createdAt");

CREATE INDEX "CallTranscriptSegment_transcriptSessionId_sequence_idx" ON "CallTranscriptSegment"("transcriptSessionId", "sequence");
CREATE INDEX "CallTranscriptSegment_callLogId_sequence_idx" ON "CallTranscriptSegment"("callLogId", "sequence");
CREATE INDEX "CallTranscriptSegment_orgId_createdAt_idx" ON "CallTranscriptSegment"("orgId", "createdAt");
CREATE UNIQUE INDEX "CallTranscriptSegment_transcriptSessionId_sequence_key" ON "CallTranscriptSegment"("transcriptSessionId", "sequence");

ALTER TABLE "CallTranscriptSession"
ADD CONSTRAINT "CallTranscriptSession_callLogId_fkey"
FOREIGN KEY ("callLogId") REFERENCES "CallLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallTranscriptSession"
ADD CONSTRAINT "CallTranscriptSession_streamSessionId_fkey"
FOREIGN KEY ("streamSessionId") REFERENCES "CallMediaStreamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallTranscriptSession"
ADD CONSTRAINT "CallTranscriptSession_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallTranscriptSegment"
ADD CONSTRAINT "CallTranscriptSegment_transcriptSessionId_fkey"
FOREIGN KEY ("transcriptSessionId") REFERENCES "CallTranscriptSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallTranscriptSegment"
ADD CONSTRAINT "CallTranscriptSegment_callLogId_fkey"
FOREIGN KEY ("callLogId") REFERENCES "CallLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallTranscriptSegment"
ADD CONSTRAINT "CallTranscriptSegment_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
