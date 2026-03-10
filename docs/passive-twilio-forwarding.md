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

## Twilio setup

Configure the Twilio number voice webhook:

- Method: `POST`
- URL: `https://<your-api>/api/twilio/voice/incoming`

Status callbacks are generated through the dial leg and should resolve to:

- `https://<your-api>/api/twilio/voice/status`

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

## Seeding a forwarding number

Use the existing Assistant Settings surface and set:

- Inbound voice mode: `Passive forwarding`
- Enable passive forwarding: checked
- Passive forwarding destination: a live office phone number
- Forwarding ring timeout: desired ring window

## Verification notes

- Existing `AI_FIRST` orgs must behave exactly as before.
- Passive-forwarding orgs must update the same canonical `CallLog`.
- No child-leg `CallLog` rows should be created in Phase 1.

## Phase 2 insertion point

Media Streams should be inserted in the centralized TwiML builder before `<Dial>`, so the rest of the routing and status-update flow stays unchanged.
