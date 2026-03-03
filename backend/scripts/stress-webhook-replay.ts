type Mode = "twilio" | "vapi" | "mixed";

function getArg(name: string, fallback = "") {
  const key = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(key));
  return arg ? arg.slice(key.length) : fallback;
}

function parseIntArg(name: string, fallback: number) {
  const parsed = Number.parseInt(getArg(name, String(fallback)), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function modeArg(): Mode {
  const raw = String(getArg("mode", "mixed")).toLowerCase();
  if (raw === "twilio") return "twilio";
  if (raw === "vapi") return "vapi";
  return "mixed";
}

function twilioPayload(index: number, toNumber: string) {
  return new URLSearchParams({
    CallSid: `CA_STRESS_${Date.now()}_${index}`,
    From: `+1516555${String(1000 + (index % 9000))}`,
    To: toNumber
  });
}

function vapiPayload(index: number, orgId: string) {
  return {
    type: "call.completed",
    call: {
      id: `vapi_stress_${Date.now()}_${index}`,
      orgId,
      customer: { number: `+1516555${String(1000 + (index % 9000))}` }
    },
    analysis: {
      summary: `Synthetic stress call #${index}`,
      successEvaluation: 0.8
    }
  };
}

async function runTask(taskIndex: number, input: { mode: Mode; baseUrl: string; orgId: string; toNumber: string }) {
  const start = Date.now();
  if (input.mode === "twilio") {
    const response = await fetch(`${input.baseUrl}/api/twilio/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: twilioPayload(taskIndex, input.toNumber)
    });
    return { status: response.status, latencyMs: Date.now() - start, endpoint: "/api/twilio/voice" };
  }
  if (input.mode === "vapi") {
    const response = await fetch(`${input.baseUrl}/api/vapi/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vapiPayload(taskIndex, input.orgId))
    });
    return { status: response.status, latencyMs: Date.now() - start, endpoint: "/api/vapi/webhook" };
  }
  if (taskIndex % 2 === 0) return runTask(taskIndex, { ...input, mode: "twilio" });
  return runTask(taskIndex, { ...input, mode: "vapi" });
}

async function main() {
  const baseUrl = String(getArg("url", "http://localhost:3001")).replace(/\/$/, "");
  const orgId = getArg("orgId", "stress-org");
  const toNumber = getArg("to", "+15163505753");
  const mode = modeArg();
  const events = Math.max(1, parseIntArg("events", 1000));
  const concurrency = Math.max(1, parseIntArg("concurrency", 200));

  const queue = Array.from({ length: events }, (_, index) => index);
  const results: Array<{ status: number; latencyMs: number; endpoint: string }> = [];

  async function worker() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next === undefined) return;
      try {
        const result = await runTask(next, { mode, baseUrl, orgId, toNumber });
        results.push(result);
      } catch {
        results.push({ status: 0, latencyMs: 0, endpoint: "request_failed" });
      }
    }
  }

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, events) }, () => worker()));
  const elapsedMs = Date.now() - startedAt;

  const ok = results.filter((result) => result.status >= 200 && result.status < 300).length;
  const failed = results.length - ok;
  const latencyValues = results.map((result) => result.latencyMs).filter((value) => value > 0).sort((a, b) => a - b);
  const p95 = latencyValues.length ? latencyValues[Math.floor(latencyValues.length * 0.95)] : 0;
  const byEndpoint = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.endpoint] = (acc[result.endpoint] || 0) + 1;
    return acc;
  }, {});

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        mode,
        baseUrl,
        orgId,
        events,
        concurrency,
        elapsedMs,
        successRate: results.length ? ok / results.length : 0,
        ok,
        failed,
        p95LatencyMs: p95,
        byEndpoint
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
