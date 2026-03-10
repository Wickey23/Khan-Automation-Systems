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

test("buildPassiveForwardDialTwiml injects a media stream before the dial leg when configured", () => {
  const twiml = buildPassiveForwardDialTwiml({
    forwardingNumber: "+15165550199",
    statusCallbackUrl: "https://example.com/api/twilio/voice/status",
    timeoutSeconds: 20,
    stream: {
      url: "wss://example.com/ws/twilio/voice-media",
      name: "call-CA123",
      track: "both_tracks",
      statusCallbackUrl: "https://example.com/api/twilio/voice/stream-status",
      customParameters: [
        { name: "callSid", value: "CA123" },
        { name: "orgId", value: "org_123" },
        { name: "token", value: "signed-token" }
      ]
    }
  }).toString();

  assert.match(twiml, /<Start>/);
  assert.match(twiml, /<Stream[^>]*url="wss:\/\/example.com\/ws\/twilio\/voice-media"/);
  assert.match(twiml, /name="call-CA123"/);
  assert.match(twiml, /track="both_tracks"/);
  assert.match(twiml, /statusCallback="https:\/\/example.com\/api\/twilio\/voice\/stream-status"/);
  assert.match(twiml, /<Parameter name="callSid" value="CA123"\/>/);
  assert.match(twiml, /<Parameter name="orgId" value="org_123"\/>/);
  assert.match(twiml, /<Parameter name="token" value="signed-token"\/>/);
  assert.ok(twiml.indexOf("<Start>") < twiml.indexOf("<Dial"));
});
