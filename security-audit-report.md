# Security Audit Findings

- Generated: 2026-03-26T16:00:56.841Z
- Scope: frontend + backend
- High: 0 | Medium: 11 | Low: 0

- severity: medium
- file: backend/src/modules/admin/admin.routes.ts:639
- explanation: Potential IDOR/org-scoping risk: entity lookup/mutation by request ID without nearby org scope check.
- recommended fix: Add org-scoped where clauses (orgId/organizationId) and verify caller access before read/write.

- severity: medium
- file: backend/src/modules/admin/admin.routes.ts:1664
- explanation: Potential IDOR/org-scoping risk: entity lookup/mutation by request ID without nearby org scope check.
- recommended fix: Add org-scoped where clauses (orgId/organizationId) and verify caller access before read/write.

- severity: medium
- file: backend/src/modules/admin/admin.routes.ts:2187
- explanation: Potential IDOR/org-scoping risk: entity lookup/mutation by request ID without nearby org scope check.
- recommended fix: Add org-scoped where clauses (orgId/organizationId) and verify caller access before read/write.

- severity: medium
- file: backend/src/modules/admin/admin.routes.ts:2269
- explanation: Potential IDOR/org-scoping risk: entity lookup/mutation by request ID without nearby org scope check.
- recommended fix: Add org-scoped where clauses (orgId/organizationId) and verify caller access before read/write.

- severity: medium
- file: backend/src/modules/admin/admin.routes.ts:2300
- explanation: Potential IDOR/org-scoping risk: entity lookup/mutation by request ID without nearby org scope check.
- recommended fix: Add org-scoped where clauses (orgId/organizationId) and verify caller access before read/write.

- severity: medium
- file: backend/src/modules/admin/admin.routes.ts:3238
- explanation: Potential IDOR/org-scoping risk: entity lookup/mutation by request ID without nearby org scope check.
- recommended fix: Add org-scoped where clauses (orgId/organizationId) and verify caller access before read/write.

- severity: medium
- file: backend/src/modules/admin/admin.routes.ts:3249
- explanation: Potential IDOR/org-scoping risk: entity lookup/mutation by request ID without nearby org scope check.
- recommended fix: Add org-scoped where clauses (orgId/organizationId) and verify caller access before read/write.

- severity: medium
- file: backend/src/modules/voice/voice.routes.ts:412
- explanation: Potential IDOR/org-scoping risk: entity lookup/mutation by request ID without nearby org scope check.
- recommended fix: Add org-scoped where clauses (orgId/organizationId) and verify caller access before read/write.

- severity: medium
- file: frontend/app/admin/orgs/page.tsx:274
- explanation: Weak default credential detected.
- recommended fix: Use an empty default and require explicit secure input/secret at runtime.

- severity: medium
- file: frontend/components/site/login-form.tsx:121
- explanation: Weak default credential detected.
- recommended fix: Use an empty default and require explicit secure input/secret at runtime.

- severity: medium
- file: frontend/components/site/signup-form.tsx:85
- explanation: Weak default credential detected.
- recommended fix: Use an empty default and require explicit secure input/secret at runtime.
