# Security Regression Policy

Target completion marker: before final closeout

## Purpose

Define the minimum CI security regression suite that must run on pull requests and main pushes.

## Minimum required suite

The security workflow must run these boundary tests:

1. step-up enforcement
2. tool trusted-context enforcement
3. Stripe replay ordering
4. Twilio failure policy
5. Vapi failure policy
6. SMS booking duplicate/stale/no-op behavior
7. abuse-hardening guards:
   - SMS governance
   - rate-limit config

## Current workflow

Workflow:
- `.github/workflows/security-regression.yml`

Current commands executed:
- `src/modules/auth/__tests__/refresh-session.service.test.ts`
- `src/middleware/__tests__/require-step-up.test.ts`
- `src/modules/admin/__tests__/step-up-coverage.test.ts`
- `src/modules/tools/__tests__/trusted-context.contract.test.ts`
- `src/modules/stripe/__tests__/webhook-replay.contract.test.ts`
- `src/modules/sms/__tests__/webhook-failure-policy.test.ts`
- `src/modules/voice/vapi/__tests__/webhook-failure-policy.test.ts`
- `src/modules/appointments/__tests__/appointment-request-sms.service.test.ts`
- `src/modules/sms/__tests__/sms-governance.service.test.ts`
- `src/middleware/__tests__/rate-limit.config.test.ts`

## Policy rule

Any regression in one of these boundary tests must fail CI.

If a route/workflow is proven security-critical and remains in scope, it must either:
- be covered by this suite
- or be promoted into the suite before the related work is considered finished

## Exit criteria

- PRs automatically run the minimum suite
- the workflow covers current high-risk boundaries, not just typecheck/lint
- evidence of the workflow run is referenced from verification artifacts where relevant
