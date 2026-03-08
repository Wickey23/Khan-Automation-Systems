# Twilio Webhook Failure Matrix

Target completion marker:
- now

## Scope

Routes:
- `POST /api/twilio/sms`
- `POST /api/twilio/sms/status`

## POST /api/twilio/sms

### Signature verification behavior
- Enforced by `verifyTwilioRequest`
- Invalid signature should return `403`

### Replay ordering
- Replay guard runs early using:
  - `sms:{MessageSid}:inbound`
- Duplicate delivery currently short-circuits before business side effects

### Durable boundary
- Durable boundary for actionable inbound SMS:
  - inbound message persisted in `Message`
  - or another deterministic duplicate-safe state written before side effects continue

### Current ack behavior
- Invalid schema: `200` safe-ignore
- Duplicate replay: `200`
- Success: `200`
- Unexpected processing exception: currently `200`

### Required patch list
1. Preserve `403` on invalid signature.
2. Preserve `200` on duplicate replay.
3. Preserve `200` safe-ignore for malformed ignorable payload.
4. Return retry-worthy non-`200` when actionable inbound SMS fails before durable persistence.
5. Keep `200` after durable persistence for downstream failures to avoid duplicate side effects.
6. Emit:
   - `WEBHOOK_DURABLE_PERSISTED`
   - `WEBHOOK_SAFE_IGNORE`
   - `WEBHOOK_RETRY_WORTHY_FAILURE`

### Failure matrix

| Event class | Expected behavior |
|---|---|
| invalid signature | `403` |
| duplicate event | `200` |
| malformed ignorable payload | `200` safe-ignore |
| retry-worthy transient failure before durable persistence | non-`200` |
| downstream failure after durable persistence | `200` |

## POST /api/twilio/sms/status

### Signature verification behavior
- Enforced by `verifyTwilioRequest`
- Invalid signature should return `403`

### Replay ordering
- Replay guard runs early using:
  - `sms:{MessageSid}:status:{status}`
- Duplicate delivery currently short-circuits before status mutation

### Durable boundary
- Durable boundary:
  - target `Message` status update durably persisted

### Current ack behavior
- Invalid schema: `200` safe-ignore
- Duplicate replay: `200`
- Success: `200`
- Unexpected processing exception: currently `200`

### Required patch list
1. Preserve `403` on invalid signature.
2. Preserve `200` on duplicate replay.
3. Preserve `200` safe-ignore for malformed ignorable payload.
4. Return retry-worthy non-`200` when actionable status callback fails before durable status persistence.
5. Keep `200` after durable persistence for downstream non-critical failures.
6. Emit:
   - `WEBHOOK_DURABLE_PERSISTED`
   - `WEBHOOK_SAFE_IGNORE`
   - `WEBHOOK_RETRY_WORTHY_FAILURE`

### Failure matrix

| Event class | Expected behavior |
|---|---|
| invalid signature | `403` |
| duplicate event | `200` |
| malformed ignorable payload | `200` safe-ignore |
| retry-worthy transient failure before durable persistence | non-`200` |
| downstream failure after durable persistence | `200` |
