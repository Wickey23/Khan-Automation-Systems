# Twilio Proof Addendum

Target completion marker: after alert routing

## Scope
- `POST /api/twilio/sms`
- `POST /api/twilio/sms/status`

## Signature verification

- Twilio signature verification occurs before route logic through webhook security middleware.
- Invalid/missing signature is rejected before business mutation and logged as `WEBHOOK_SIGNATURE_INVALID`.

## Replay ordering

### Inbound SMS
- Replay key: inbound `MessageSid`
- Duplicate detection occurs before durable message persistence and before request/assistant side effects.

### Status callback
- Replay key: `MessageSid + MessageStatus`
- Duplicate detection occurs before durable status mutation.

## Durable boundaries

### `POST /api/twilio/sms`
- Durable boundary: inbound message persisted or deterministic duplicate-safe handling state written.
- After this point, downstream failures may return safe success because duplicate re-delivery will not recreate side effects.

### `POST /api/twilio/sms/status`
- Durable boundary: outbound message row status update persisted for the matching `providerMessageId`.

## Matching/scoping proof

### Status callback scoping
- Stored `providerMessageId` is authoritative.
- Query `orgId` does not widen authority.
- If query `orgId` conflicts with the stored message owner, the route safe-ignores the query scope and updates only the actual message owner row.

## Ack matrix

| Event class | Behavior |
|---|---|
| invalid signature | `403` |
| duplicate inbound/status event | `200` |
| malformed ignorable payload | `200` safe-ignore |
| actionable pre-durable transient failure | `500` retry-worthy |
| downstream failure after durable persistence | `200` |

## Evidence

Tests already covering this:
- `backend/src/modules/sms/__tests__/webhook-failure-policy.test.ts`

Key assertions:
- actionable pre-durable failures return retry-worthy `500`
- mismatched query org safe-ignores correctly
- unknown status callback messages safe-ignore with `200`

## Conclusion

Current Twilio webhook behavior is explicitly proven safe under the hardened failure policy and does not require additional architectural changes.
