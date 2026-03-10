import assert from "node:assert/strict";
import test from "node:test";
import { resolveBusinessVoiceRouting } from "../business-voice-routing.service";

test("resolveBusinessVoiceRouting returns passive forwarding config when mapped number is found", async () => {
  const prisma = {
    phoneNumber: {
      findFirst: async () => ({
        id: "pn_1",
        orgId: "org_1",
        e164Number: "+15165550100",
        organization: {
          id: "org_1",
          name: "Demo Shop",
          live: true,
          status: "LIVE",
          aiAgentConfigs: [],
          businessSettings: {
            voiceRoutingMode: "PASSIVE_FORWARDING",
            voiceForwardingEnabled: true,
            voiceForwardingNumber: "+15165550199",
            voiceRingTimeoutSeconds: 18
          }
        }
      }),
      findMany: async () => []
    }
  } as any;

  const resolved = await resolveBusinessVoiceRouting({
    prisma,
    calledNumber: "+15165550100",
    defaultRingTimeoutSeconds: 20
  });

  assert.equal(resolved?.voiceRoutingMode, "PASSIVE_FORWARDING");
  assert.equal(resolved?.forwardingNumber, "+15165550199");
  assert.equal(resolved?.ringTimeoutSeconds, 18);
  assert.equal(resolved?.passiveForwardingValid, true);
});

test("resolveBusinessVoiceRouting defaults existing orgs to AI_FIRST", async () => {
  const prisma = {
    phoneNumber: {
      findFirst: async () => ({
        id: "pn_2",
        orgId: "org_2",
        e164Number: "+15165550111",
        organization: {
          id: "org_2",
          name: "Existing Org",
          live: true,
          status: "LIVE",
          aiAgentConfigs: [],
          businessSettings: null
        }
      }),
      findMany: async () => []
    }
  } as any;

  const resolved = await resolveBusinessVoiceRouting({
    prisma,
    calledNumber: "+15165550111",
    defaultRingTimeoutSeconds: 20
  });

  assert.equal(resolved?.voiceRoutingMode, "AI_FIRST");
  assert.equal(resolved?.passiveForwardingValid, false);
});
