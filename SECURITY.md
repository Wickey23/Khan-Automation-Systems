# KHAN Systems Security Baseline

## Scope
This document defines the enforced enterprise-baseline controls for KHAN Systems.

## Enforced Controls
- Cookie auth with secure production settings (`HttpOnly`, `Secure`, `SameSite=None`, `Path=/`).
- Refresh session rotation with reuse detection and family revocation.
- CSRF protection (double-submit token) for cookie-auth mutating routes in production mode.
- Role + permission checks for privileged admin/system operations.
- Strict webhook signature/secret validation in production/strict mode.
- Webhook replay guard with duplicate detection.
- Security audit log events for auth, RBAC, replay, and anomaly detection.
- Log redaction for secrets and auth headers/cookies.
- CSP + browser security headers in report-only rollout mode.

## Threat Boundaries
- Browser auth boundary:
  - Session cookies are accepted only with CORS credentials and explicit trusted origins.
  - Mutating actions require CSRF cookie/header match in production.
- Webhook trust boundary:
  - Invalid provider signatures/secrets are blocked with 401/403.
  - Schema-invalid payloads are acknowledged (200), audited, and ignored.
  - Replays are acknowledged (200), audited, and ignored.
- Multi-tenant isolation:
  - Org-scoped user routes derive org from token context, not request body.
  - Replay and tool actions include org-safe constraints.
- Admin operations:
  - System mutations require explicit permission checks.
  - Critical override paths require elevated role constraints.

## Operational Notes
- In-process rate limits are per-instance only.
- Distributed brute-force attacks can bypass per-instance buckets.
- Detection controls are implemented through audit anomaly counters.

## Explicit Non-Goals
- No SOC2, PCI, or HIPAA certification work in this window.
- No external security infra (no Redis, queues, Kafka, SIEM ingestion).
- No architecture refactor.

## Related Ops Artifacts
- Scale gate evaluation in admin system endpoints.
- Incident/open-resolve audit actions and readiness checks.
