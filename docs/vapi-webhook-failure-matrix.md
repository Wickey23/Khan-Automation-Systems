# Vapi Webhook Failure Matrix

Target completion marker:
- after Twilio matrix

## Scope

Route:
- `POST /api/vapi/webhook`

## Secret verification behavior
- Enforced by `verifyVapiToolSecret`
- Invalid secret should return `403`

## Replay ordering
- Replay guard runs early when `callSid` exists using:
  - `vapi:{callSid}:{eventType}`
- Duplicate events currently short-circuit before business side effects

## Durable boundary
- For actionable call events, durable handling requires:
  - webhook event persisted via `persistVapiWebhookEvent(...)`
  - and if finalization is required, finalizer job enqueued durably

## Current ack behavior
- Invalid schema: `200` safe-ignore
- Duplicate replay: `200`
- Missing call id: `200` safe-ignore / queued-backfill style response
- Unresolved org: `200` safe-ignore / queued-backfill style response
- Success: `200`
- Unexpected processing exception: currently `200`

## Required patch list
1. Preserve `403` on invalid secret.
2. Preserve `200` on duplicate replay.
3. Preserve `200` safe-ignore for malformed ignorable payloads, missing call id, and unresolved-org cases that are intentionally non-actionable.
4. Return retry-worthy non-`200` when an actionable Vapi event fails before:
   - webhook event persistence, or
   - required finalizer enqueue
5. Keep `200` for downstream failures after the durable boundary.
6. Emit:
   - `WEBHOOK_DURABLE_PERSISTED`
   - `WEBHOOK_SAFE_IGNORE`
   - `WEBHOOK_RETRY_WORTHY_FAILURE`

## Failure matrix

| Event class | Expected behavior |
|---|---|
| invalid secret | `403` |
| duplicate event | `200` |
| malformed ignorable payload | `200` safe-ignore |
| retry-worthy transient failure before durable persistence | non-`200` |
| downstream failure after durable persistence | `200` |

## Notes

- Blanket `200` on all unexpected failures is not acceptable for actionable events because it can silently drop booking-relevant state.
- Replay protection and durable enqueue must stay ahead of downstream classification, notifications, and other side effects.
