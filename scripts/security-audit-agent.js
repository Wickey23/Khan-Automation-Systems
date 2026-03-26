#!/usr/bin/env node

/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIRS = ["frontend", "backend"];
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  "tmp"
]);

const ROUTE_AUTH_KEYWORDS = [
  "requireAuth",
  "authGuard",
  "authenticate",
  "requireRole",
  "requireAdmin",
  "ensureOrgAccess",
  "withUser",
  "withAuth"
];

const PUBLIC_ROUTE_HINTS = [
  "/health",
  "/status",
  "/webhook",
  "/twilio/",
  "/vapi/",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot",
  "/auth/reset",
  "/accept-invite",
  "/unsubscribe"
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function walkFiles(startDir, files = []) {
  if (!fs.existsSync(startDir)) return files;
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walkFiles(abs, files);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) files.push(abs);
  }
  return files;
}

function toRepoPath(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, "/");
}

function addFinding(findings, finding) {
  findings.push(finding);
}

function scanByRegex(filePath, content, findings) {
  const lines = content.split(/\r?\n/);
  const rules = [
    {
      severity: "high",
      regex: /\b(?:api[_-]?key|secret|token|password|passwd|jwtSecret|clientSecret)\b\s*[:=]\s*["'`]([A-Za-z0-9_\-./+=]{8,})["'`]/i,
      explanation: "Potential hardcoded credential or secret-like value.",
      fix: "Move the value to environment variables or secret manager and load via runtime config."
    },
    {
      severity: "high",
      regex: /-----BEGIN (?:RSA|EC|OPENSSH|DSA)? ?PRIVATE KEY-----/,
      explanation: "Private key material appears in source.",
      fix: "Remove key material from code/history and load from a secure secret store."
    },
    {
      severity: "high",
      regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
      explanation: "JWT-like token appears hardcoded in source.",
      fix: "Replace with env-driven test fixtures or runtime-injected values; rotate token if real."
    },
    {
      severity: "medium",
      regex: /\b(?:admin|delete|default)?password\b[^=\n]*=\s*["'`](?:123|1234|password|admin|qwerty|changeme)["'`]/i,
      explanation: "Weak default credential detected.",
      fix: "Use an empty default and require explicit secure input/secret at runtime."
    },
    {
      severity: "medium",
      regex: /res\.(?:status\(\d+\)\.)?(?:json|send)\(\s*(?:err|error|e)\s*\)/,
      explanation: "Raw error object may be returned to clients, risking data exposure.",
      fix: "Return a sanitized error payload and log internal details server-side only."
    },
    {
      severity: "high",
      regex: /\beval\s*\(/,
      explanation: "Dynamic code execution via eval detected.",
      fix: "Replace with explicit parsing or a constrained allowlisted dispatcher."
    },
    {
      severity: "high",
      regex: /\bnew Function\s*\(/,
      explanation: "Dynamic function creation detected.",
      fix: "Replace with static code paths and explicit mappings."
    },
    {
      severity: "high",
      regex: /\bchild_process\.(?:exec|execSync)\s*\(/,
      explanation: "Command execution pattern detected; potential injection risk.",
      fix: "Use spawn/execFile with strict argument allowlists and avoid shell interpolation."
    },
    {
      severity: "medium",
      regex: /\bdangerouslySetInnerHTML\b/,
      explanation: "Direct HTML injection surface detected.",
      fix: "Sanitize content with a trusted sanitizer and keep allowed tags minimal."
    }
  ];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const rule of rules) {
      if (!rule.regex.test(line)) continue;
      const lower = line.toLowerCase();
      if (
        rule.explanation.includes("hardcoded credential") &&
        (lower.includes("process.env") ||
          lower.includes("example") ||
          lower.includes("placeholder") ||
          lower.includes("dummy") ||
          lower.includes("test"))
      ) {
        continue;
      }
      addFinding(findings, {
        severity: rule.severity,
        file: toRepoPath(filePath),
        line: i + 1,
        explanation: rule.explanation,
        recommendation: rule.fix
      });
    }
  }
}

function extractRouteCall(lines, startIndex) {
  let joined = "";
  let depth = 0;
  let opened = false;
  const maxLines = Math.min(lines.length, startIndex + 18);
  for (let i = startIndex; i < maxLines; i += 1) {
    const segment = lines[i];
    joined += `${segment}\n`;
    for (const ch of segment) {
      if (ch === "(") {
        depth += 1;
        opened = true;
      } else if (ch === ")") {
        depth = Math.max(0, depth - 1);
      }
    }
    if (opened && depth === 0 && segment.includes(")")) break;
  }
  return joined;
}

function routeLooksPublic(routePath) {
  const normalized = (routePath || "").toLowerCase();
  return PUBLIC_ROUTE_HINTS.some((hint) => normalized.includes(hint));
}

function scanBackendRoutes(filePath, content, findings) {
  const repoPath = toRepoPath(filePath);
  if (!repoPath.startsWith("backend/")) return;
  const lines = content.split(/\r?\n/);
  const fileHasGlobalAuth = ROUTE_AUTH_KEYWORDS.some((keyword) =>
    content.includes(`router.use(${keyword}`) || content.includes(`app.use(${keyword}`)
  );

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const routeMatch = line.match(/\b(?:router|app)\.(get|post|put|patch|delete)\s*\(/i);
    if (!routeMatch) continue;
    const method = routeMatch[1].toLowerCase();
    const routeCall = extractRouteCall(lines, i);
    const pathMatch = routeCall.match(/["'`]([^"'`]+)["'`]/);
    const routePath = pathMatch ? pathMatch[1] : "";
    const hasAuth = fileHasGlobalAuth || ROUTE_AUTH_KEYWORDS.some((keyword) => routeCall.includes(keyword));
    const isMutation = method === "post" || method === "put" || method === "patch" || method === "delete";
    const publicAllowed = routeLooksPublic(routePath);

    if (isMutation && !hasAuth && !publicAllowed) {
      const severity = routePath.includes("/admin") ? "high" : "medium";
      addFinding(findings, {
        severity,
        file: repoPath,
        line: i + 1,
        explanation: `Mutation route (${method.toUpperCase()} ${routePath || "unknown"}) appears to lack explicit auth middleware.`,
        recommendation: "Add explicit auth + role/org access middleware for this route, or document why it must remain public."
      });
    }

    if (!isMutation && !hasAuth && routePath.includes("/admin") && !publicAllowed) {
      addFinding(findings, {
        severity: "high",
        file: repoPath,
        line: i + 1,
        explanation: `Admin route (${method.toUpperCase()} ${routePath}) appears to lack explicit auth middleware.`,
        recommendation: "Gate admin routes with authentication and role checks before handler execution."
      });
    }
  }
}

function scanOrgScoping(filePath, content, findings) {
  const repoPath = toRepoPath(filePath);
  if (!repoPath.startsWith("backend/")) return;
  const lines = content.split(/\r?\n/);
  const prismaCallRegex = /\bprisma\.\w+\.(findUnique|findFirst|update|delete|upsert)\s*\(/;

  for (let i = 0; i < lines.length; i += 1) {
    if (!prismaCallRegex.test(lines[i])) continue;
    const contextStart = Math.max(0, i - 12);
    const contextEnd = Math.min(lines.length, i + 18);
    const context = lines.slice(contextStart, contextEnd).join("\n");
    const hasDirectId = /req\.(?:params|body|query)\.[A-Za-z0-9_]*id/i.test(context);
    const hasOrgScope = /\borgId\b/.test(context) || /\borganizationId\b/.test(context);
    if (hasDirectId && !hasOrgScope) {
      addFinding(findings, {
        severity: "medium",
        file: repoPath,
        line: i + 1,
        explanation: "Potential IDOR/org-scoping risk: entity lookup/mutation by request ID without nearby org scope check.",
        recommendation: "Add org-scoped where clauses (orgId/organizationId) and verify caller access before read/write."
      });
    }
  }
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.severity}|${finding.file}|${finding.line}|${finding.explanation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function severitySort(a, b) {
  const score = { high: 3, medium: 2, low: 1 };
  const diff = score[b.severity] - score[a.severity];
  if (diff !== 0) return diff;
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  return a.line - b.line;
}

function toMarkdown(findings) {
  const counts = findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  const lines = [];
  lines.push("# Security Audit Findings");
  lines.push("");
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Scope: frontend + backend`);
  lines.push(`- High: ${counts.high} | Medium: ${counts.medium} | Low: ${counts.low}`);
  lines.push("");

  if (!findings.length) {
    lines.push("No actionable findings detected by current rules.");
    lines.push("");
    return lines.join("\n");
  }

  for (const finding of findings) {
    lines.push(`- severity: ${finding.severity}`);
    lines.push(`- file: ${finding.file}:${finding.line}`);
    lines.push(`- explanation: ${finding.explanation}`);
    lines.push(`- recommended fix: ${finding.recommendation}`);
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const allFiles = TARGET_DIRS.flatMap((dir) => walkFiles(path.join(ROOT, dir)));
  const findings = [];

  for (const filePath of allFiles) {
    const content = readFileSafe(filePath);
    if (!content) continue;
    scanByRegex(filePath, content, findings);
    scanBackendRoutes(filePath, content, findings);
    scanOrgScoping(filePath, content, findings);
  }

  const deduped = dedupeFindings(findings).sort(severitySort);
  const markdown = toMarkdown(deduped);
  const outputFile = path.join(ROOT, "security-audit-report.md");
  fs.writeFileSync(outputFile, markdown, "utf8");

  console.log(markdown);
  console.log(`\nSaved report: ${toRepoPath(outputFile)}`);

  const highCount = deduped.filter((f) => f.severity === "high").length;
  process.exitCode = highCount > 0 ? 1 : 0;
}

main();
