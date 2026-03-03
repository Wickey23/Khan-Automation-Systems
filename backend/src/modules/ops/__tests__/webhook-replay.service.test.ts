import assert from "node:assert/strict";
import test from "node:test";
import { registerWebhookReplay } from "../webhook-replay.service";

test("registerWebhookReplay returns duplicate false on create success", async () => {
  const prisma = {
    webhookReplayGuard: {
      async create() {
        return {};
      }
    }
  } as any;
  const result = await registerWebhookReplay(prisma, { provider: "TWILIO", eventKey: "voice:1:inbound" });
  assert.equal(result.duplicate, false);
});

test("registerWebhookReplay returns duplicate true on create conflict", async () => {
  const prisma = {
    webhookReplayGuard: {
      async create() {
        throw { code: "P2002" };
      }
    }
  } as any;
  const result = await registerWebhookReplay(prisma, { provider: "TWILIO", eventKey: "voice:1:inbound" });
  assert.equal(result.duplicate, true);
});

test("registerWebhookReplay uses __global__ scope when orgId is missing", async () => {
  let orgIdSeen = "";
  const prisma = {
    webhookReplayGuard: {
      async create(input: any) {
        orgIdSeen = String(input?.data?.orgId || "");
        return {};
      }
    }
  } as any;
  await registerWebhookReplay(prisma, { provider: "VAPI", eventKey: "call:abc:end" });
  assert.equal(orgIdSeen, "__global__");
});
