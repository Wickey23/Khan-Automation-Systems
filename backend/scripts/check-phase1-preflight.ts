import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";

type Step = {
  name: string;
  args: string[];
};

const steps: Step[] = [
  {
    name: "Phase 1 env check",
    args: ["--transpile-only", path.join("scripts", "check-phase1-env.ts")]
  },
  {
    name: "Phase 1 schema check",
    args: ["--transpile-only", path.join("scripts", "check-phase1-schema.ts")]
  }
];

let failed = false;

for (const step of steps) {
  // eslint-disable-next-line no-console
  console.log(`\n==> ${step.name}`);
  const result = spawnSync("ts-node", step.args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if ((result.status || 0) !== 0) {
    failed = true;
    // eslint-disable-next-line no-console
    console.error(`\n${step.name} failed.`);
  }
}

if (failed) {
  // eslint-disable-next-line no-console
  console.error("\nPhase 1 preflight failed. Fix errors above before staging/production rollout.");
  process.exitCode = 1;
} else {
  // eslint-disable-next-line no-console
  console.log("\nPhase 1 preflight passed.");
}
