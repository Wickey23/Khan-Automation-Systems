# Vapi Proof Addendum

Target completion marker: after Twilio proof

## Scope
- `POST /api/vapi/webhook`

## Secret verification

- Vapi webhook secret verification occurs before route business logic through webhook security middleware.
- Invalid secret is rejected before actionable processing and logged as `WEBHOOK_SIGNATURE_INVALID`.

## Replay ordering

- Replay key: `callSid + eventType`
- Duplicate detection occurs before event persistence, queueing, or call mutation side effects.

## Durable boundary

An actionable Vapi event is treated as durably handled only when:
1. the Vapi event is persisted, and
2. any required finalize job is durably queued

Only after that point may downstream failures return `200`.

## Ack matrix

| Event class | Behavior |
|---|---|
| invalid secret | `403` |
| duplicate event | `200` |
| malformed ignorable payload | `200` safe-ignore |
| actionable pre-durable transient failure | `500` retry-worthy |
| downstream failure after durable persistence | `200` |

## Evidence

Tests already covering this:
- `backend/src/modules/voice/vapi/__tests__/webhook-failure-policy.test.ts`

Key assertions:
- actionable pre-durable failures return `500`
- malformed ignorable payloads safe-ignore with `200`
- downstream failures after durable persistence return `200`

## Conclusion

Current Vapi webhook behavior is explicitly proven against the durable-processing rules and does not require broader architectural changes.
