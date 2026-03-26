# Security Audit Agent

Reusable, read-only security scanner for this repository (`frontend` + `backend`).

## Run

```bash
npm run security:audit
```

## Output

- Console output with findings in this format:
  - `severity: high|medium|low`
  - `file: path:line`
  - `explanation`
  - `recommended fix`
- Saved report: `security-audit-report.md`

## What It Checks

1. Hardcoded secrets, tokens, API keys, private keys, JWT-like literals.
2. Unsafe credential defaults (e.g., weak hardcoded passwords).
3. Potential missing auth on backend API routes (especially mutations/admin routes).
4. Potential org-scoping/IDOR risks (ID-based Prisma operations without nearby org scope checks).
5. Improper error exposure patterns (`res.json(error)` / `res.send(error)`).
6. Security-sensitive patterns (`eval`, `new Function`, `child_process.exec`, `dangerouslySetInnerHTML`).

## Safety

- The scanner never modifies source code.
- It only reads files and writes `security-audit-report.md`.

## Reuse Workflow

1. Run after major backend/frontend changes.
2. Triage findings by severity.
3. Fix high findings first, then medium.
4. Re-run until high-risk findings are cleared.

## Notes on Accuracy

- Rules are tuned to prioritize actionable signals and reduce noise.
- Some findings are heuristic (especially auth/org-scope checks) and should be validated in context before changes.
