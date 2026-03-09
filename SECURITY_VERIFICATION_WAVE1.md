# Security Verification Wave 1

This document verifies the Wave 1A/1B `P0` security fixes merged in commit `360e3c2`.

Evidence retention rule:
- commit hash: `360e3c2`
- test names: listed per finding below
- validation output reference: local validation commands listed below; CI reference is `.github/workflows/security-regression.yml`

Target completion marker:
- now

## Validation Commands

Local validation already run against the patch batch:

```powershell
cd backend
npx tsc --noEmit
node -r dotenv/config -r ts-node/register/transpile-only src/modules/auth/__tests__/refresh-session.service.test.ts
node -r dotenv/config -r ts-node/register/transpile-only src/middleware/__tests__/require-step-up.test.ts
node -r dotenv/config -r ts-node/register/transpile-only src/modules/appointments/__tests__/appointment-request-sms.service.test.ts
node -r dotenv/config -r ts-node/register/transpile-only src/modules/admin/__tests__/step-up-coverage.test.ts
node -r dotenv/config -r ts-node/register/transpile-only src/modules/tools/__tests__/trusted-context.contract.test.ts
node -r dotenv/config -r ts-node/register/transpile-only src/modules/stripe/__tests__/webhook-replay.contract.test.ts
node -r dotenv/config -r ts-node/register/transpile-only src/modules/sms/__tests__/webhook-failure-policy.test.ts
node -r dotenv/config -r ts-node/register/transpile-only src/modules/voice/vapi/__tests__/webhook-failure-policy.test.ts
```

## Findings

### 1. Admin 2FA config path fix
- Severity: `P0-C`
- Patch commit: `360e3c2`
- Files changed:
  - `backend/src/modules/auth/auth.routes.ts`
  - `backend/src/config/env.ts`
- Tests added:
  - route/login-path coverage currently indirect through auth behavior and step-up changes
- Validation:
  - `npx tsc --noEmit`
- Status: `fixed`
- Residual risk: `coverage expansion`
- Notes:
  - 2FA enforcement now uses validated config instead of the wrong raw env flag path
  - still needs broader route/auth integration coverage

### 2. Logout refresh-session revocation
- Severity: `P0-C`
- Patch commit: `360e3c2`
- Files changed:
  - `backend/src/modules/auth/auth.routes.ts`
  - `backend/src/modules/auth/refresh-session.service.ts`
- Tests added:
  - `refresh-session.service.test.ts`
- Validation:
  - `refresh-session.service.test.ts`
  - `npx tsc --noEmit`
- Status: `verified`
- Residual risk: `integration proof needed`
- Notes:
  - current refresh session is revoked server-side on logout before cookies are cleared
  - still needs route-level logout-followed-by-refresh integration proof

### 3. Step-up authentication primitive
- Severity: `P0-C`
- Patch commit: `360e3c2`
- Files changed:
  - `backend/src/lib/auth.ts`
  - `backend/src/modules/auth/auth.routes.ts`
  - `backend/src/middleware/require-step-up.ts`
  - `backend/src/modules/auth/auth.schema.ts`
- Tests added:
  - `require-step-up.test.ts`
- Validation:
  - `require-step-up.test.ts`
  - `npx tsc --noEmit`
- Status: `verified`
- Residual risk: `coverage expansion`
- Notes:
  - signed short-lived step-up proof now exists
  - needs broader route-level coverage for all critical admin mutations

### 4. Step-up enforcement on critical admin mutations
- Severity: `P0-C`
- Patch commit: `360e3c2`
- Files changed:
  - `backend/src/modules/admin/admin.routes.ts`
  - `backend/src/middleware/require-step-up.ts`
- Tests added:
  - `step-up-coverage.test.ts`
- Validation:
  - `npx tsc --noEmit`
- Status: `fixed`
- Residual risk: `integration proof needed`
- Notes:
  - critical mutating admin/control-plane routes now require recent step-up
  - broader route inventory and explicit deny/allow integration tests are still needed

### 5. Tool org-authority hardening
- Severity: `P0-C`
- Patch commit: `360e3c2`
- Files changed:
  - `backend/src/modules/tools/tools.routes.ts`
- Tests added:
  - `trusted-context.contract.test.ts`
- Validation:
  - `npx tsc --noEmit`
- Status: `fixed`
- Residual risk: `integration proof needed`
- Notes:
  - protected tool routes now require trusted call linkage
  - unsafe `orgId` / env / single-org fallback authority paths were removed for the protected routes in scope

### 6. Stripe replay guard
- Severity: `P0-I`
- Patch commit: `360e3c2`
- Files changed:
  - `backend/src/modules/stripe/stripe.routes.ts`
- Tests added:
  - `webhook-replay.contract.test.ts`
- Validation:
  - `npx tsc --noEmit`
- Status: `fixed`
- Residual risk: `integration proof needed`
- Notes:
  - Stripe replay is now blocked by `event.id`
  - still needs explicit test proving replay short-circuits before side effects

### 7. SMS booking deterministic idempotency
- Severity: `P0-I`
- Patch commit: `360e3c2`
- Files changed:
  - `backend/src/modules/appointments/appointment-request-sms.service.ts`
  - `backend/src/modules/appointments/booking.service.ts`
- Tests added:
  - `appointment-request-sms.service.test.ts`
- Validation:
  - `appointment-request-sms.service.test.ts`
  - `npx tsc --noEmit`
- Status: `verified`
- Residual risk: `integration proof needed`
- Notes:
  - duplicate booking attempts for the same request/offer/slot now converge on a deterministic idempotency key
  - still needs simultaneous inbound reply coverage

### 8. Canonical AppointmentRequest scheduling after SMS booking
- Severity: `P0-I`
- Patch commit: `360e3c2`
- Files changed:
  - `backend/src/modules/appointments/appointment-request-sms.service.ts`
  - `backend/src/modules/appointments/appointment-request.service.ts`
- Tests added:
  - `appointment-request-sms.service.test.ts`
- Validation:
  - `appointment-request-sms.service.test.ts`
  - `npx tsc --noEmit`
- Status: `verified`
- Residual risk: `integration proof needed`
- Notes:
  - successful SMS booking now canonically marks the request `SCHEDULED` and links `appointmentId`
  - still needs end-to-end duplicate/stale/no-op reply coverage

## Residual Risk Summary

- Coverage expansion needed:
  - admin 2FA behavior
  - step-up enforcement breadth
- Integration proof needed:
  - logout followed by refresh attempt
  - admin mutating routes with/without step-up
  - trusted vs untrusted tool execution
  - Stripe replay short-circuit ordering
  - duplicate/simultaneous SMS booking replies

## Next Workstreams

- after Twilio matrix: patch Twilio failure-policy behavior
- after Vapi patch: patch Vapi failure-policy behavior
- before Wave 2: complete the first broader integration test batch
