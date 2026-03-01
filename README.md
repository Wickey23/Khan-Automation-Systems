# Khan Automation Systems Monorepo

Full-stack multi-tenant SaaS foundation for:
- Marketing site + lead capture
- Stripe subscriptions
- Client dashboard
- Admin operations dashboard
- Manual Twilio number provisioning and AI behavior controls per client

## Apps

- `frontend/` - Next.js 14 App Router + TypeScript + Tailwind
- `backend/` - Express + TypeScript + Prisma + PostgreSQL

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Start Postgres (optional but recommended):
```bash
docker compose up -d
```

3. Create env files:
- `frontend/.env.local` from `frontend/.env.example`
- `backend/.env` from `backend/.env.example`

4. Generate Prisma client + migrate + seed admin:
```bash
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend
npm run seed:admin
```

5. Run both apps:
```bash
npm run dev
```

## Core Flow

1. Customer visits pricing and clicks `Start Starter` or `Start Pro`.
2. Backend creates Stripe Checkout session.
3. Stripe webhook creates/updates:
   - `Client`
   - `User` (CLIENT role)
   - `Subscription`
   - `Setting`
   - `AIConfig` (default)
4. Customer logs in and completes `/dashboard/setup`.
5. Admin opens `/admin/clients/:id` and:
   - assigns Twilio number
   - sets AI config
   - sets status to `LIVE`
6. Test call to assigned number; Twilio hits `/api/twilio/voice?clientId=...`.

## Backend Env Vars

```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/khan_automation?schema=public
ALLOWED_ORIGIN=http://localhost:3000
JWT_SECRET=change-this-to-a-long-random-secret
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@khanautomationsystems.com
ADMIN_PASSWORD=change-this-admin-password
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Khan Automation Systems <no-reply@example.com>
LEAD_NOTIFICATION_EMAIL=owner@example.com
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_STARTER_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_SUCCESS_URL=http://localhost:3000/checkout/success
STRIPE_CANCEL_URL=http://localhost:3000/checkout/cancel
FRONTEND_APP_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000
AUTO_LIVE_ON_SETUP=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_SID=
```

## Frontend Env Vars

```env
NEXT_PUBLIC_API_BASE=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CALENDLY_URL=CALENDLY_LINK_HERE
NEXT_PUBLIC_DEMO_NUMBER=DEMO_NUMBER_HERE
```

## Admin Twilio Assignment

Admin UI: `/admin/clients/:id`

1. Set preferred area code (optional)
2. Toggle SMS enabled (optional)
3. Click `Assign number`
4. Backend:
   - finds available Twilio local number
   - purchases number
   - saves `PhoneLine`
   - configures webhooks:
     - `${API_BASE_URL}/api/twilio/voice?clientId=...`
     - `${API_BASE_URL}/api/twilio/sms?clientId=...`

Optional replace:
- `POST /api/admin/clients/:id/twilio/replace-number`

## Twilio Webhook Behavior (MVP)

`POST /api/twilio/voice?clientId=xxx`

- if client status != `LIVE`: friendly inactive message
- if `LIVE`:
  - reads `Setting.businessHoursJson`, `Setting.transferNumber`, `AIConfig.greetingText`, `AIConfig.afterHoursMessage`
  - after-hours: plays after-hours message and hangs up
  - within-hours: plays greeting and dials transfer number
- logs `Call` record (`TRANSFERRED` or `UNKNOWN`)

`POST /api/twilio/sms?clientId=xxx`
- returns simple TwiML response based on status + `AIConfig.smsEnabled`

## Stripe Endpoints

- `POST /api/stripe/create-checkout-session`
- `POST /api/stripe/webhook`
- `POST /api/stripe/customer-portal`

## Auth Model

- `POST /api/auth/login` (CLIENT or ADMIN)
- `POST /api/auth/logout`
- `GET /api/auth/me`
- Admin endpoints protected by role check
- Client endpoints protected by role check

## Client Dashboard Routes

- `/dashboard`
- `/dashboard/setup`
- `/dashboard/calls`
- `/dashboard/leads`
- `/dashboard/settings`
- `/dashboard/billing`
- `/dashboard/support`

Client users can edit only `Setting` fields.  
Client users cannot edit `PhoneLine` or `AIConfig`.

## Admin Routes (Client Ops)

- `/admin/clients`
- `/admin/clients/:id`

API:
- `GET /api/admin/clients`
- `GET /api/admin/clients/:id`
- `PATCH /api/admin/clients/:id/status`
- `GET /api/admin/clients/:id/leads`
- `GET /api/admin/clients/:id/calls`
- `GET /api/admin/clients/:id/phone-line`
- `POST /api/admin/clients/:id/twilio/assign-number`
- `POST /api/admin/clients/:id/twilio/replace-number`
- `GET /api/admin/clients/:id/ai-config`
- `PATCH /api/admin/clients/:id/ai-config`

## Deployment

### Backend on Render (standalone)

Render service settings:
- Root Directory: `backend`
- Runtime: `Node`
- Node version: `20.x`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Important:
- Backend is independently deployable from `backend/` and does not require the monorepo root or frontend build.
- `postinstall` runs `prisma generate` automatically.
- Render free plan does not support robust predeploy hooks. Use:
  - First production setup: `npm run db:push:prod` (or `npx prisma db push`) from backend shell/context
  - Ongoing schema changes with migrations: `npx prisma migrate deploy`

Required backend environment variables on Render:
- `DATABASE_URL` (Render Postgres connection string)
- `PORT` (Render sets this automatically; keep support in app)
- `ALLOWED_ORIGIN` (your Vercel frontend URL)
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `API_BASE_URL` (public Render backend URL, e.g. `https://api.yourdomain.com`)
- `FRONTEND_APP_URL`
- `LEAD_NOTIFICATION_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

### Frontend on Vercel
- Root Directory: `frontend`
- Set `NEXT_PUBLIC_API_BASE` to your Render backend URL
- Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL

## Stripe Webhook Setup

Use Stripe CLI or dashboard endpoint:
- `https://YOUR_BACKEND_DOMAIN/api/stripe/webhook`

## Twilio Webhook Setup / Testing

For local tests, expose backend using ngrok:
```bash
ngrok http 4000
```

Set `API_BASE_URL` to ngrok URL and assign number again (or reconfigure webhooks).

## Build Verification

```bash
npm run build --workspace backend
npm run build --workspace frontend
```

## Multi-tenant Portals (v2 foundation)

### Roles
- `SUPER_ADMIN` (operator)
- `CLIENT_ADMIN` (owner/manager)
- `CLIENT_STAFF` (future support)

### Client Portal Routes
- `/auth/signup`
- `/auth/login`
- `/auth/logout`
- `/app`
- `/app/onboarding`
- `/app/settings`
- `/app/calls`
- `/app/leads`

### Operator/Admin Routes
- `/admin/login`
- `/admin/orgs`
- `/admin/orgs/[id]`
- `/admin/leads`

### Core Backend APIs
- Auth:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Billing:
  - `POST /api/billing/create-checkout-session`
  - `POST /api/billing/webhook`
  - `GET /api/billing/status`
- Org scoped:
  - `GET /api/org/profile`
  - `PATCH /api/org/profile`
  - `GET /api/org/onboarding`
  - `PUT /api/org/onboarding`
  - `POST /api/org/onboarding/submit`
  - `GET /api/org/subscription`
  - `GET /api/org/leads`
  - `GET /api/org/calls`
- Admin org operations:
  - `GET /api/admin/orgs`
  - `GET /api/admin/orgs/:id`
  - `PATCH /api/admin/orgs/:id/status`
  - `POST /api/admin/orgs/:id/notes`
  - `POST /api/admin/orgs/:id/twilio/assign-number`
  - `PATCH /api/admin/orgs/:id/ai/config`
  - `POST /api/admin/orgs/:id/go-live`
  - `POST /api/admin/orgs/:id/pause`

### Stripe Local Webhook Testing
```bash
stripe listen --forward-to http://localhost:4000/api/billing/webhook
```

### Twilio Webhook Stubs
- `POST /api/twilio/voice`
- `POST /api/twilio/sms`

Twilio routing is org-aware by inbound `To` number lookup (`PhoneNumber.e164Number`).

## Client-Ready Operations v1

### Provisioning Pipeline Statuses
- `NEW`
- `ONBOARDING`
- `SUBMITTED`
- `NEEDS_CHANGES`
- `APPROVED`
- `PROVISIONING`
- `TESTING`
- `LIVE`
- `PAUSED`

### New Operational Models
- `ProvisioningChecklist` (step-by-step go-live controls)
- `AuditLog` (admin/operator action trace)
- `BusinessSettings` (org-level behavior settings for call routing)
- Expanded `AiAgentConfig` with Vapi fields (`vapiAgentId`, `vapiPhoneNumberId`, prompt/tools/intake schema)
- Expanded `CallLog` (`aiProvider`, `aiSummary`, `appointmentRequested`, `leadId`)
- Expanded `OnboardingSubmission` with `configPackageJson`

### New Backend Endpoints
- Client/org:
  - `GET /api/org/settings`
  - `PATCH /api/org/settings`
  - `POST /api/org/onboarding/preview`
- Admin provisioning:
  - `POST /api/admin/orgs/:id/provisioning/approve-onboarding`
  - `POST /api/admin/orgs/:id/provisioning/generate-ai-config`
  - `POST /api/admin/orgs/:id/provisioning/checklist-step`
  - `POST /api/admin/orgs/:id/provisioning/testing`
  - `POST /api/admin/orgs/:id/provisioning/test-complete`
- Vapi runtime + tools:
  - `POST /api/vapi/webhook`
  - `POST /api/tools/create-lead-from-call`
  - `POST /api/tools/send-sms`
  - `POST /api/tools/notify-manager`
  - `POST /api/tools/request-appointment`
  - `POST /api/tools/transfer-call`

### Security Enhancements
- Twilio webhook signature validation (enabled when `TWILIO_AUTH_TOKEN` is set)
- Vapi tool/webhook secret validation via `VAPI_TOOL_SECRET`
- Rate limiting applied to public webhook routes

### Vapi + Twilio Setup Checklist
1. Set backend env:
   - `VAPI_API_KEY`
   - `VAPI_TOOL_SECRET`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `API_BASE_URL`
2. In admin org detail:
   - approve onboarding
   - generate AI config package
   - assign Twilio number
   - set `vapiAgentId` and `vapiPhoneNumberId` in AI config
   - move org to testing, then go live
3. Configure Vapi tool calls to use:
   - `${API_BASE_URL}/api/tools/*`
   - include `x-vapi-tool-secret: <VAPI_TOOL_SECRET>`
4. Configure Vapi webhook to:
   - `${API_BASE_URL}/api/vapi/webhook`
   - include `x-vapi-tool-secret: <VAPI_TOOL_SECRET>`

### Render/Prod Schema Workflow
Render free tier usually requires manual schema sync for major model updates:
```bash
cd backend
npx prisma db push
```

Then redeploy backend.
