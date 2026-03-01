const { execSync } = require("child_process");
const { writeFileSync } = require("fs");
const { join } = require("path");

function getReleaseTag() {
  try {
    const count = execSync("git rev-list --count HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    const n = Number.parseInt(count, 10);
    if (Number.isFinite(n) && n > 0) return `v${n}`;
  } catch {
    // ignore and fallback
  }
  return "v1";
}

const releaseTag = getReleaseTag();
const target = join(__dirname, "..", "lib", "release-tag.ts");
writeFileSync(target, `export const RELEASE_TAG = "${releaseTag}";\n`, "utf8");
console.log(`[release-tag] ${releaseTag}`);
