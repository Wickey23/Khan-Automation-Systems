# Wave 2 Rate-Limit Matrix

Target completion marker: now -> before Wave 2 patches are finalized

This matrix is the source of truth for the first Wave 2 abuse-hardening pass.

| Surface | Route / flow | Current state before Wave 2 | Wave 2 control |
|---|---|---|---|
| Auth | `/api/auth/signup` | shared auth limiter | dedicated signup limiter |
| Auth | `/api/auth/login` | shared auth limiter | dedicated login limiter |
| Auth | `/api/auth/login/verify-otp` | shared auth limiter | dedicated OTP verify limiter |
| Auth | `/api/auth/login/resend-otp` | shared auth limiter | dedicated OTP resend limiter |
| Auth | `/api/auth/forgot-password` | shared auth limiter | dedicated forgot-password limiter |
| Auth | `/api/auth/reset-password` | shared auth limiter | dedicated reset-password limiter |
| Auth | `/api/auth/refresh` | shared auth limiter | dedicated refresh limiter |
| Auth | `/api/auth/step-up` | shared auth limiter | dedicated step-up limiter |
| Auth | `/api/auth/security/send-test-otp` | shared auth limiter | dedicated security OTP limiter |
| Webhook | `/api/twilio/voice` | generic webhook limiter | Twilio voice limiter |
| Webhook | `/api/twilio/sms` | generic webhook limiter | Twilio SMS limiter |
| Webhook | `/api/vapi/webhook` | generic webhook limiter | Vapi webhook limiter |
| Webhook | `/api/stripe/webhook` | no dedicated limiter | Stripe webhook limiter |
| Tools | `/api/tools/**` | generic tool limiter | base tool limiter + route-specific read/mutation limiters |
| Manual SMS | `/api/org/messages/send` | no org-level SMS quota | org hourly/daily SMS quota |
| Request offer SMS | `/api/org/appointment-requests/:id/offer-slots` | no resend suppression | per-request slot-offer cap + org SMS quota |
| Request reply clarifications | canonical request-SMS reply flow | no clarification cap | per-request clarification cap + org SMS quota |
| Worker request follow-up | post-call request SMS | no org-level SMS quota | org hourly/daily SMS quota |
| Booking confirmation | appointment confirmation SMS | no org-level SMS quota | org hourly/daily SMS quota |
| AI automation | call classification | existing business-settings daily cap | keep existing cap; no duplicate cap path introduced in this batch |

Default caps introduced in Wave 2:

- org outbound SMS hourly cap: `60`
- org outbound SMS daily cap: `250`
- appointment request slot-offer cap per request: `4`
- appointment request clarification cap per request: `3`

Rules:

- quota exhaustion stops automation and logs suppression
- no request-related automated loop may continue indefinitely
- safe but untested routes should gain regression tests instead of reopening broad audit
