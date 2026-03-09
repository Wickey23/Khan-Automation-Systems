# Security Live Validation Checklist

Target completion marker: after deployment

## Goal

Confirm deployed behavior matches the hardened repo behavior.

## Validate

### 1. Admin step-up
- privileged admin mutation without fresh step-up is denied
- same mutation with valid fresh step-up succeeds

### 2. Tool trusted-context enforcement
- valid trusted tool context succeeds
- untrusted tool call fails closed
- foreign-org tool request fails closed

### 3. Twilio webhook behavior
- duplicate-safe behavior is visible
- retry-worthy failures produce the expected signal
- status callback updates only the correct message row

### 4. Vapi webhook behavior
- duplicate-safe behavior is visible
- retry-worthy failures produce the expected signal
- actionable events persist/enqueue before `200`

### 5. Security dashboard visibility
- security counters increment
- recent security events render correctly
- security alerts appear with the expected severity

### 6. Alert routing
- signature invalid threshold produces an operator-visible alert
- retry-worthy webhook threshold produces an alert
- tool org-context rejection threshold produces an alert
- SMS suppression threshold produces org-relevant alerting

## Evidence to capture

- deploy commit hash
- admin dashboard screenshot or exported values
- relevant provider/test request IDs
- alert IDs or org notification IDs
- any mismatch discovered between local/CI and deployed behavior

## Exit criteria

- deployed behavior matches hardened repo expectations
- no major operational mismatch remains unexplained
