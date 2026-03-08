# Security Dashboard Spec

Target completion marker: before Wave 3 dashboard implementation

## Purpose

Give operations one surface for security-relevant failures that can affect tenant isolation, booking integrity, or cost abuse.

## Minimum counters

- `step_up.forbidden`
- `tool.org_context_rejected`
- `webhook.signature_invalid`
- `webhook.replay_blocked`
- `webhook.retry_worthy_failure`
- `sms.automation_suppressed`
- `sms.request_offer_suppressed`
- `sms.request_clarification_suppressed`
- `quota.org_sms_hourly`
- `quota.org_sms_daily`

## Minimum drill-down dimensions

- `orgId`
- `route`
- `provider`
- `requestId`
- `actorUserId`
- `reason`

## Initial log/event mappings

- `STEP_UP_FORBIDDEN`
- `TOOL_ORG_CONTEXT_REJECTED`
- `WEBHOOK_SIGNATURE_INVALID`
- `WEBHOOK_REPLAY_BLOCKED`
- `WEBHOOK_RETRY_WORTHY_FAILURE`
- `SMS_AUTOMATION_SUPPRESSED`

## Alerting thresholds

- any sustained increase in `webhook.retry_worthy_failure`
- spike in `webhook.signature_invalid`
- repeated `TOOL_ORG_CONTEXT_REJECTED`
- repeated `SMS_AUTOMATION_SUPPRESSED` for a single org

## Exit criteria

- the security regression workflow is active in CI
- all required structured events are emitted by the backend
- the dashboard can answer:
  - are privileged actions being blocked by expired step-up?
  - are tool requests being rejected for missing trusted context?
  - are webhook retries increasing?
  - are SMS quotas or loop suppressions firing for a specific org?
