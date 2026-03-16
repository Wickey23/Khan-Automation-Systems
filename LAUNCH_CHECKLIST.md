# Launch Checklist

This checklist is specific to `Khan-Automation-Systems` as it exists today.

## Priority 0: Production Stability

- [ ] Confirm the backend service runs with exactly `1` instance in production.
- [ ] Redeploy backend on commit `e8ddf2f` or newer so safer worker defaults are active.
- [ ] Explicitly set backend env vars in production:
  - `FINALIZE_BOOKING_WORKER_INTERVAL_MS=30000`
  - `OUTREACH_RUNNER_INTERVAL_MS=300000`
  - `VAPI_BACKFILL_INTERVAL_MS=300000`
- [ ] If DB pool pressure continues, temporarily disable nonessential workers:
  - `OUTREACH_RUNNER_ENABLED=false`
  - `VAPI_BACKFILL_ENABLED=false`
  - `ADMIN_REPORTS_ENABLED=false`
- [ ] Verify `DATABASE_URL` targets the intended production database.
- [ ] Watch backend logs after redeploy for:
  - Prisma pool timeout errors
  - repeated worker failures
  - auth refresh loops

## Priority 1: Public Site Readiness

- [ ] Verify the public header shows the current release tag (`v_`) after deploy.
- [ ] Smoke test:
  - `/`
  - `/how-it-works`
  - `/contact`
  - `/privacy`
  - `/terms`
- [ ] Check mobile and tablet layout for:
  - header
  - hero
  - pricing cards
  - operator showcase
  - reliability showcase

## Priority 2: Content and Trust Surface

- [ ] Standardize public contact emails.
  - Current repo uses multiple variants:
    - `hello@khansystems.com`
    - `hello@khanautomationsystems.com`
    - `support@khanautomationsystems.com`
    - `privacy@khansystems.com`
    - `legal@khansystems.com`
- [ ] Decide final public support inboxes:
  - general/contact
  - support
  - privacy
  - legal
- [ ] Replace any remaining placeholder org/demo names visible on public pages if any remain after review.
- [ ] Confirm pricing/setup language is final:
  - Founding Partner
  - Standard
  - Growth / Pro
- [ ] Confirm CTA wording is final:
  - `Book a Demo`
  - `Talk to Sales`
  - `Apply for Founding`

## Priority 3: Legal Cleanup

- [ ] Decide whether to keep both legal routes:
  - `/privacy`
  - `/privacy-policy`
- [ ] Prefer one canonical privacy route and redirect or remove the other.
- [ ] Review `terms` and `privacy` copy for real company/legal wording.
- [ ] Confirm legal entity naming and jurisdiction language before launch.

## Priority 4: SEO and Metadata

- [x] `robots.ts` exists
- [x] `sitemap.ts` exists
- [x] base metadata and Open Graph metadata exist in `frontend/app/layout.tsx`
- [ ] Verify final production domain in:
  - `frontend/app/layout.tsx`
  - sitemap output
  - robots output
- [ ] Confirm `/og-image.png` exists and is production-ready.
- [ ] Add canonical-domain checks if domain strategy changes.

## Priority 5: Analytics and Conversion Tracking

- [ ] Add analytics for public-site conversion actions:
  - hero CTA clicks
  - pricing CTA clicks
  - contact/demo submissions
  - onboarding starts
- [ ] Decide analytics provider:
  - Vercel Analytics
  - Plausible
  - PostHog
  - GA4
- [ ] Track form submit success/failure states.

## Priority 6: App Smoke Test

- [ ] Client app smoke test:
  - `/app`
  - `/app/calls`
  - `/app/leads`
  - `/app/appointments`
  - `/app/messages`
  - `/app/settings`
- [ ] Admin app smoke test:
  - `/admin/orgs`
  - `/admin/orgs/[id]`
  - `/admin/calls`
  - `/admin/reports`
  - `/admin/events`
- [ ] Confirm auth flows:
  - login
  - refresh
  - logout
- [ ] Confirm no console errors in browser during normal navigation.

## Current Repo Findings

- Backend worker pressure has already been reduced in code, but production env overrides can still negate that.
- Public SEO scaffolding already exists:
  - `frontend/app/layout.tsx`
  - `frontend/app/robots.ts`
  - `frontend/app/sitemap.ts`
- Public legal/support pages already exist:
  - `frontend/app/contact/page.tsx`
  - `frontend/app/how-it-works/page.tsx`
  - `frontend/app/privacy/page.tsx`
  - `frontend/app/terms/page.tsx`
- There is duplicate privacy routing in the repo:
  - `frontend/app/privacy/page.tsx`
  - `frontend/app/privacy-policy/page.tsx`
- Public email/contact strings are not fully standardized yet.

## Suggested Execution Order

1. Stabilize production backend envs and redeploy.
2. Standardize public contact/legal emails and privacy route.
3. Do full browser smoke test on public + app/admin routes.
4. Add analytics/conversion tracking.
5. Final legal/copy review before launch.
