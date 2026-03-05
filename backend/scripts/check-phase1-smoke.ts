import "dotenv/config";
import { spawnSync } from "node:child_process";

type Step = {
  name: string;
  command: string;
  args: string[];
  required?: boolean;
};

type StepResult = {
  name: string;
  ok: boolean;
  note?: string;
};

function runCommand(step: Step): StepResult {
  // eslint-disable-next-line no-console
  console.log(`\n==> ${step.name}`);
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  const ok = (result.status || 0) === 0;
  if (!ok && step.required !== false) {
    return { name: step.name, ok: false, note: "required check failed" };
  }
  if (!ok) {
    return { name: step.name, ok: true, note: "optional check failed (ignored)" };
  }
  return { name: step.name, ok: true };
}

async function checkApiEndpoint(baseUrl: string, path: string, expectedStatus: number) {
  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
  const response = await fetch(url, { method: "GET" });
  const ok = response.status === expectedStatus;
  return {
    name: `GET ${path} => ${expectedStatus}`,
    ok,
    note: ok ? undefined : `got ${response.status}`
  } as StepResult;
}

async function run() {
  const results: StepResult[] = [];

  const coreSteps: Step[] = [
    {
      name: "Phase 1 preflight (env + schema)",
      command: "npm",
      args: ["run", "phase1:preflight"]
    },
    {
      name: "Backend typecheck",
      command: "npx",
      args: ["tsc", "--noEmit", "-p", "tsconfig.json"]
    }
  ];

  for (const step of coreSteps) {
    results.push(runCommand(step));
    if (!results[results.length - 1].ok) {
      summarize(results);
      process.exitCode = 1;
      return;
    }
  }

  const baseUrl = String(process.env.API_BASE_URL || "").trim();
  if (!baseUrl) {
    results.push({
      name: "API sanity checks",
      ok: true,
      note: "skipped (API_BASE_URL not set)"
    });
  } else {
    try {
      results.push(await checkApiEndpoint(baseUrl, "/", 200));
      results.push(await checkApiEndpoint(baseUrl, "/api/health", 200));
      results.push(await checkApiEndpoint(baseUrl, "/api/status", 200));
      // Unauthenticated org route should be protected.
      results.push(await checkApiEndpoint(baseUrl, "/api/org/profile", 401));
    } catch (error) {
      results.push({
        name: "API sanity checks",
        ok: false,
        note: error instanceof Error ? error.message : "unknown api error"
      });
    }
  }

  summarize(results);
  if (results.some((row) => !row.ok)) {
    process.exitCode = 1;
  }
}

function summarize(results: StepResult[]) {
  const failed = results.filter((r) => !r.ok);
  const passed = results.length - failed.length;
  // eslint-disable-next-line no-console
  console.log(`\nPhase 1 smoke summary: ${passed} passed, ${failed.length} failed`);
  for (const row of results) {
    // eslint-disable-next-line no-console
    console.log(`[${row.ok ? "PASS" : "FAIL"}] ${row.name}${row.note ? ` - ${row.note}` : ""}`);
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Phase 1 smoke check crashed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
