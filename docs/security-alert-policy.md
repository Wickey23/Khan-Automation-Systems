# Security Alert Policy

Target completion marker: now

## Purpose

Turn security signals already emitted by the backend into actionable operator/admin notifications without creating duplicate noise.

## Alert families

### 1. Webhook signature invalid spike
- Signal: `WEBHOOK_SIGNATURE_INVALID`
- Threshold: 5 events in 15 minutes by `provider + endpoint + reason`
- Audience: internal operators only
- Severity: warning, escalating operationally if sustained
- Delivery:
  - system audit alert: `SECURITY_ALERT_WEBHOOK_SIGNATURE_INVALID_SPIKE`
  - visible in admin system dashboard recent security events/counters

### 2. Retry-worthy webhook failure spike
- Signal: `WEBHOOK_RETRY_WORTHY_FAILURE`
- Threshold: 3 events in 15 minutes by `orgId + provider + endpoint`
- Audience:
  - internal operators always
  - org admins when `orgId` is known
- Severity: critical
- Delivery:
  - system audit alert: `SECURITY_ALERT_WEBHOOK_RETRY_FAILURE_SPIKE`
  - org notification: `SECURITY_WEBHOOK_RETRY_FAILURE`

### 3. Tool org-context rejection spike
- Signal: `TOOL_ORG_CONTEXT_REJECTED`
- Threshold: 5 events in 15 minutes by route
- Audience: internal operators only
- Severity: warning
- Purpose:
  - leaked tool secret
  - integration misuse
  - bad client/provider configuration
- Delivery:
  - system audit alert: `SECURITY_ALERT_TOOL_CONTEXT_REJECTED_SPIKE`

### 4. SMS automation suppression spike
- Signal: `SMS_AUTOMATION_SUPPRESSED`
- Threshold: first occurrence per `orgId + reason + source`, deduped for 60 minutes
- Audience:
  - org admins
  - internal operators via audit visibility
- Severity: action required
- Delivery:
  - system audit alert: `SECURITY_ALERT_SMS_SUPPRESSION_SPIKE`
  - org notification: `SECURITY_SMS_AUTOMATION_SUPPRESSED`

## Metadata contract

Every emitted alert should include the smallest useful metadata set for triage:
- `provider`
- `endpoint`
- `orgId` if known
- `route` if applicable
- `count`
- `windowMinutes`
- `reason`
- `source`

Do not include:
- raw provider secrets
- full authorization headers
- full webhook payloads

## Dedupe rule

All alerts must dedupe inside a bounded window:
- system audit spike alerts: 60 minutes
- org notifications: 60 minutes

This prevents repeated failures from flooding operators.

## Exit criteria

- key security signal families generate consistent, deduped alerts
- internal operators can see them in the admin system dashboard
- org admins receive org-relevant alerts only where appropriate
- alert creation remains non-fatal to the protected business workflow
