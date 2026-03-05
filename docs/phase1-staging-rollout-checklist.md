# KHAN Systems Phase 1 Staging Rollout Checklist

Use this checklist to validate Phase 1 safely before production enablement.

## 1) Environment

Set backend env vars:

- `FEATURE_APPOINTMENTS_ENABLED=true`
- `FEATURE_CALENDAR_OAUTH_ENABLED=true`
- `FEATURE_NOTIFICATIONS_V1_ENABLED=true`
- `FEATURE_CLASSIFICATION_V1_ENABLED=true`
- `FEATURE_PIPELINE_STAGE_ENABLED=true`
- `FEATURE_PHASE1_ORG_ALLOWLIST=<staging-org-id>`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_CALLBACK_URL`
- `OUTLOOK_OAUTH_CLIENT_ID`
- `OUTLOOK_OAUTH_CLIENT_SECRET`
- `OUTLOOK_OAUTH_CALLBACK_URL`
- `OPENAI_API_KEY` (only required if LLM fallback is enabled)
- `ENCRYPTION_KEY_BASE64` (required for encrypted calendar token storage)

Quick validate before deploy:

```powershell
cd backend
npm run phase1:preflight
```

## 2) Database

Run from `backend`:

```powershell
npx prisma db push
npx prisma generate
```

Confirm new Phase 1 tables/columns exist:

- `Appointment`
- `AppointmentHold`
- `CalendarConnection`
- `OrgNotification`
- `CallClassificationLog`
- `Lead.pipelineStage` and classification/qualification fields
- `BusinessSettings` Phase 1 config fields

## 3) Access & Gating

Validate role and plan behavior:

- Viewer cannot access Team or billing mutations.
- Team endpoints require active/trialing Pro plan.
- Invite seat enforcement uses `active + pending <= allowedSeats`.
- Self role-change/remove is blocked.

## 4) Appointment & Availability Locks

Validate deterministic availability:

- Response shape is exactly:
  - `{ "slots": [{ "startAt": "...", "endAt": "..." }] }`
- `slotStepMinutes=15`
- Overlap uses:
  - `existing.startAt < new.endAt && existing.endAt > new.startAt`
- `end == close` allowed, overflow past close blocked.
- Max 10 slots, sorted ascending.

Validate booking commit:

- Hold created first (`HELD`)
- Re-check overlap at commit
- External create success => `CONFIRMED`, provider/event id persisted
- External create fail => fallback path sets `PENDING` or `NEEDS_SCHEDULING`

## 5) Calendar OAuth (Create-Only)

Validate both providers:

- Connect flow stores encrypted tokens.
- `sync-test` creates a short event.
- Token refresh works.
- Revoked token path marks connection inactive.
- No provider webhooks required.

## 6) Notifications v1

Validate:

- DB notification row created for all emitted events.
- Visibility respects `targetRoleMin`.
- Email delivery is best-effort and does not break request path.
- `notificationEmailRecipientsJson` and `notificationTogglesJson` honored.

## 7) Classification v1

Validate:

- Rules-first classification runs.
- LLM fallback only for low confidence/ambiguous calls.
- Daily cap enforced; cap reached => no LLM call.
- Shadow mode ON logs only; no lead mutation.
- Shadow mode OFF applies lead classification/qualification updates.

## 8) Analytics & ROI

Validate `/api/org/analytics` additive fields:

- `appointmentsBooked`
- `qualifiedLeads`
- `missedCallsRecovered`
- `conversionRate`
- `averageJobValueUsd`
- `estimatedRevenueOpportunityUsd`

## 9) Frontend

Validate:

- Sidebar order is correct.
- Team link Pro-gated.
- Appointments page works with filters and status actions.
- Settings page includes calendar + notifications + classification controls.
- Viewer analytics is summary-only.

## 10) Production Enablement

Roll out with allowlist first:

1. Keep all `FEATURE_*` base flags `true`.
2. Set `FEATURE_PHASE1_ORG_ALLOWLIST` to a small set of org ids.
3. Validate metrics/logs for 24h.
4. Expand allowlist in batches.
5. Set allowlist to `*` only after stable operation.
