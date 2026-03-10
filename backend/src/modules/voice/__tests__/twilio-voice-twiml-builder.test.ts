import assert from "node:assert/strict";
import test from "node:test";
import { buildPassiveForwardDialTwiml } from "../twilio-voice-twiml-builder";

test("buildPassiveForwardDialTwiml returns immediate dial TwiML with status callbacks", () => {
  const twiml = buildPassiveForwardDialTwiml({
    forwardingNumber: "+15165550199",
    statusCallbackUrl: "https://example.com/api/twilio/voice/status",
    timeoutSeconds: 18
  }).toString();

  assert.match(twiml, /<Dial[^>]*answerOnBridge="true"/);
  assert.match(twiml, /timeout="18"/);
  assert.match(twiml, /statusCallback="https:\/\/example.com\/api\/twilio\/voice\/status"/);
  assert.match(twiml, /statusCallbackEvent="initiated ringing answered completed"/);
  assert.match(twiml, /<Number[^>]*>\+15165550199<\/Number>/);
});
