# Passive Twilio Forwarding

Phase 1 passive forwarding keeps the caller experience normal:

1. Business number forwards to Twilio
2. Twilio posts to `/api/twilio/voice/incoming`
3. Khan resolves the org from the existing `PhoneNumber` mapping
4. If the org is in `PASSIVE_FORWARDING`, Twilio immediately dials the business forwarding number
5. Status callbacks update the same canonical `CallLog`

## Required environment variables

- `API_BASE_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WEBHOOK_BASE_URL`
- `TWILIO_STATUS_CALLBACK_URL` (optional override)
- `TWILIO_VALIDATE_SIGNATURES`
- `DEFAULT_VOICE_RING_TIMEOUT_SECONDS`
- `TWILIO_MEDIA_STREAM_BASE_URL` (required only when media streaming is enabled)
- `TWILIO_MEDIA_STREAM_STATUS_CALLBACK_URL` (optional override)
- `TWILIO_MEDIA_STREAM_PATH` (default `/ws/twilio/voice-media`)
- `TWILIO_MEDIA_STREAM_TOKEN_SECRET` (required when media streaming is enabled)
- `DEEPGRAM_API_KEY` (required only when transcription is enabled)
- `TRANSCRIPTION_PROVIDER` (default `deepgram`)
- `TRANSCRIPTION_ENABLED_DEFAULT` (default `false`)
- `CALL_SUMMARY_MODEL` (default `gpt-4o-mini`)

## Twilio setup

Configure the Twilio number voice webhook:

- Method: `POST`
- URL: `https://<your-api>/api/twilio/voice/incoming`

Status callbacks are generated through the dial leg and should resolve to:

- `https://<your-api>/api/twilio/voice/status`

If real-time media streaming is enabled for a passive-forwarding org, Khan also injects:

- `wss://<your-api>/ws/twilio/voice-media`
- `POST https://<your-api>/api/twilio/voice/stream-status`

Forwarding still remains the primary caller experience. Stream setup must never block the forwarded call.

## Local development

1. Start the backend locally.
2. Expose it with `ngrok http 4000` or your local backend port.
3. Set the Twilio number webhook to:
   - `POST https://<ngrok>/api/twilio/voice/incoming`
4. Ensure the target org has:
   - a mapped `PhoneNumber`
   - `voiceRoutingMode = PASSIVE_FORWARDING`
   - `voiceForwardingEnabled = true`
   - `voiceForwardingNumber` populated
   - optional `voiceMediaStreamingEnabled = true` for Phase 2 stream testing
   - optional `voiceTranscriptionEnabled = true` for Phase 3 transcript testing

## Test checklist

1. Call the Twilio number.
2. Confirm a `CallLog` row is created immediately.
3. Confirm the forwarding destination rings.
4. Answer the forwarded call and verify the call completes normally.
5. Check `/admin/calls` for:
   - from number
   - to number
   - forwarded to number
   - call status
   - dial leg status
   - missed reason
   - Twilio SID
6. Test:
   - answered call
   - no answer
   - busy
   - failed destination
   - unmapped inbound number
   - missing forwarding config
   - media-enabled answered call
   - media-disabled answered call

## Seeding a forwarding number

Use the existing Assistant Settings surface and set:

- Inbound voice mode: `Passive forwarding`
- Enable passive forwarding: checked
- Passive forwarding destination: a live office phone number
- Forwarding ring timeout: desired ring window
- Enable real-time media streaming: optional per-org toggle
- Enable real-time transcription: optional per-org toggle layered on top of media streaming

## Verification notes

- Existing `AI_FIRST` orgs must behave exactly as before.
- Passive-forwarding orgs must update the same canonical `CallLog`.
- No child-leg `CallLog` rows should be created in Phase 1.

## Phase 2 media streams

When `voiceMediaStreamingEnabled = true` for a passive-forwarding org:

1. The inbound TwiML adds `<Start><Stream>` before `<Dial>`
2. Twilio connects to `wss://<your-api>/ws/twilio/voice-media`
3. Khan validates the upgrade request and the signed internal stream token
4. Stream lifecycle is stored in `CallMediaStreamSession`
5. The canonical `CallLog` remains the parent call record

Phase 2 handles:

- `connected`
- `start`
- `media`
- `dtmf` (ignored or low-verbosity logged)
- `stop`

Phase 2 does not:

- transcribe audio
- store raw media payloads in Postgres
- alter forwarding behavior

## Local stream test checklist

1. Expose the backend with a public HTTPS/WSS-capable tunnel.
2. Set:
   - `API_BASE_URL=https://<ngrok>`
   - `TWILIO_WEBHOOK_BASE_URL=https://<ngrok>`
   - `TWILIO_MEDIA_STREAM_BASE_URL=wss://<ngrok-host>`
   - `TWILIO_MEDIA_STREAM_TOKEN_SECRET=<strong-secret>`
3. Enable real-time media streaming for a passive-forwarding org.
4. Call the Twilio number.
5. Verify:
   - the forwarded destination rings normally
   - `connected`, `start`, `media`, and `stop` events are logged
   - a `CallMediaStreamSession` row is created
   - `/admin/calls` shows media stream state on the same canonical call

## Sample expected media logs

```json
{"eventType":"MEDIA_STREAM_UPGRADE_ACCEPTED","provider":"TWILIO","status":"OK"}
{"eventType":"MEDIA_STREAM_STARTED","provider":"TWILIO","status":"OK"}
{"eventType":"MEDIA_STREAM_MEDIA_FIRST_PACKET","provider":"TWILIO","status":"OK"}
{"eventType":"MEDIA_STREAM_STOPPED","provider":"TWILIO","status":"OK"}
```

## Phase 3 transcription and call intelligence

When both `voiceMediaStreamingEnabled` and `voiceTranscriptionEnabled` are enabled for a passive-forwarding org:

1. Media frames continue through the Phase 2 stream pipeline
2. Khan forwards the decoded audio to Deepgram in real time
3. Stable transcript segments are persisted to `CallTranscriptSegment`
4. Final transcript text is assembled back onto `CallLog.transcript`
5. Post-call summary is written to `CallLog.aiSummary`
6. Existing lead records may be updated or created when the transcript contains enough useful business signal

Phase 3 still does not:

- change forwarding behavior
- store raw audio payloads
- add AI answering

## Local transcription test checklist

1. Set:
   - `DEEPGRAM_API_KEY`
   - `TRANSCRIPTION_PROVIDER=deepgram`
   - `TRANSCRIPTION_ENABLED_DEFAULT=false`
   - `CALL_SUMMARY_MODEL=gpt-4o-mini`
2. Enable both real-time media streaming and real-time transcription for a passive-forwarding org.
3. Place a live call through the Twilio number.
4. Verify:
   - transcript sessions are created for the call
   - stable transcript segments appear in admin call detail
   - `CallLog.transcript` is assembled after the call ends
   - `CallLog.aiSummary` is generated after the call ends
   - routing and forwarding behavior remain unchanged if Deepgram is unavailable
