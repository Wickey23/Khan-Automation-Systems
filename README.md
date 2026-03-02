# Khan Automation Systems

Multi-tenant SaaS for AI receptionist operations:
- Client portal (`/app`) for onboarding, calls, leads, billing, messaging.
- Admin portal (`/admin`) for provisioning, readiness gating, testing, go-live operations.
- Voice/SMS runtime via Twilio + Vapi.

## Stack
- Frontend: Next.js 14, TypeScript, Tailwind
- Backend: Express, TypeScript, Prisma, PostgreSQL

## Local Setup
1. Install deps:
```bash
npm install
```
2. Create env files:
- `frontend/.env.local` from `frontend/.env.example`
- `backend/.env` from `backend/.env.example`
3. Generate Prisma client + apply schema:
```bash
npm run prisma:generate --workspace backend
npx prisma db push --schema backend/prisma/schema.prisma
```
4. Run apps:
```bash
npm run dev
```

## Core Runtime Flow
1. Client signs up / logs in.
2. Client completes onboarding in `/app/onboarding`.
3. Admin reviews org in `/admin/orgs/[id]`.
4. Admin provisions number + AI config, runs tests, resolves readiness blockers.
5. Admin clicks Go Live (hard-gated by readiness checks).
6. Inbound calls and SMS are handled and logged by org.

## Key Backend Routes

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Billing (Stripe)
- `POST /api/billing/create-checkout-session`
- `POST /api/billing/change-plan`
- `GET /api/billing/status`
- `POST /api/billing/customer-portal`
- `POST /api/billing/webhook` (raw body + signature verification)

### Client Org
- `GET /api/org/profile`
- `PATCH /api/org/profile`
- `GET /api/org/settings`
- `PATCH /api/org/settings`
- `GET /api/org/onboarding`
- `PUT /api/org/onboarding`
- `POST /api/org/onboarding/preview`
- `POST /api/org/onboarding/submit`
- `GET /api/org/config-package`
- `GET /api/org/calls`
- `POST /api/org/calls/repopulate`
- `GET /api/org/messages`
- `POST /api/org/messages/send`
- `GET /api/org/leads`

### Admin Ops
- `GET /api/admin/orgs`
- `GET /api/admin/orgs/:id`
- `GET /api/admin/orgs/:id/readiness`
- `POST /api/admin/orgs/:id/config-package/generate`
- `GET /api/admin/orgs/:id/config-package`
- `GET /api/admin/orgs/:id/testing`
- `POST /api/admin/orgs/:id/testing/run`
- `POST /api/admin/orgs/:id/provisioning/approve-onboarding`
- `POST /api/admin/orgs/:id/provisioning/generate-ai-config`
- `POST /api/admin/orgs/:id/twilio/assign-number`
- `PATCH /api/admin/orgs/:id/ai/config`
- `POST /api/admin/orgs/:id/go-live`
- `POST /api/admin/orgs/:id/pause`
- `GET /api/admin/events`
- `POST /api/admin/system/backfill-vapi-calls`

### Voice / SMS / Tools
- `POST /api/twilio/voice`
- `POST /api/twilio/sms`
- `POST /api/vapi/webhook`
- `POST /api/tools/create-lead-from-call`
- `POST /api/tools/send-sms`
- `POST /api/tools/notify-manager`
- `POST /api/tools/request-appointment`
- `POST /api/tools/transfer-call`

## Readiness Gating
`GET /api/admin/orgs/:id/readiness` computes:
- `billingActive`
- `onboardingSubmitted`
- `onboardingApproved`
- `businessSettingsValid`
- `providerLineAssigned`
- `toolSecretConfigured`
- `webhooksVerified`
- `notificationsVerified`
- `testCallsPassed`

`POST /api/admin/orgs/:id/go-live` is blocked unless all checks pass.

## Go Live Checklist
1. Confirm active paid subscription in billing.
2. Onboarding submitted and approved.
3. Generate Config Package.
4. Generate AI prompt/tools from Config Package.
5. Assign number provider + active number.
6. Save AI config (`vapiAgentId`, `vapiPhoneNumberId`).
7. Verify webhook wiring and `x-vapi-tool-secret`.
8. Complete testing harness with PASS coverage:
   - At least 5 PASS runs.
   - Includes after-hours scenario.
   - Includes transfer scenario.
9. Verify manager notifications.
10. Go Live.

## Ops Runbook
1. Open `/admin/orgs/[id]`, review readiness blockers first.
2. Use `/admin/orgs/[id]/testing` to log PASS/FAIL with notes and call IDs.
3. Use `/admin/events` for audit and timeline tracing.
4. If calls are missing:
   - Check `POST /api/vapi/webhook` delivery in provider logs.
   - Validate `x-vapi-tool-secret`.
   - Review `WebhookEventLog` reason/payload snippet.
   - Run admin backfill: `POST /api/admin/system/backfill-vapi-calls`.
5. If Twilio voice fails:
   - Confirm number webhook points to `/api/twilio/voice`.
   - Confirm org has active assigned number and AI config.
   - Review backend logs by request ID.

## Required Backend Env Vars
See `backend/.env.example`. Critical vars:
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_ACTION_PASSWORD` (required, min 8 chars)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `FRONTEND_APP_URL`
- `API_BASE_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `VAPI_TOOL_SECRET`
- `VAPI_API_KEY` (or `VAPI_PRIVATE_KEY`)

## Deployment
- Backend (Render): root `backend`, build `npm ci && npm run build`, start `npm start`.
- Frontend (Vercel): root `frontend`.
- Run Prisma schema sync for production when schema changes:
```bash
npx prisma db push --schema backend/prisma/schema.prisma
```
