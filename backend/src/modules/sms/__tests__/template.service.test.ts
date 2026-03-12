import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppointmentSlotOfferFallback,
  buildMissedCallRecoveryFallback,
  buildNewLeadAcknowledgementFallback,
  renderOperationalSmsTemplate
} from "../template.service";

test("missed-call recovery fallback uses intake-safe wording", () => {
  const message = buildMissedCallRecoveryFallback({
    businessName: "Khan Automation Systems",
    customerName: "Alex"
  });
  assert.match(message, /missed your call/i);
  assert.match(message, /reply with what you need help with/i);
  assert.match(message, /team will follow up shortly/i);
  assert.doesNotMatch(message, /dispatch|emergency assistance|on the way/i);
});

test("new-lead acknowledgement fallback asks for address when needed and stays non-dispatch", () => {
  const needsAddress = buildNewLeadAcknowledgementFallback({
    businessName: "Khan Automation Systems",
    customerName: "Jamie",
    needsAddress: true
  });
  assert.match(needsAddress, /reply with the service address/i);
  assert.doesNotMatch(needsAddress, /dispatch|on the way/i);

  const withAddress = buildNewLeadAcknowledgementFallback({
    businessName: "Khan Automation Systems",
    customerName: "Jamie",
    serviceAddress: "12 Oak St"
  });
  assert.match(withAddress, /received your service request at 12 Oak St/i);
  assert.match(withAddress, /team will follow up shortly/i);
});

test("renderOperationalSmsTemplate preserves the stop footer and token replacement", () => {
  const message = renderOperationalSmsTemplate({
    template: "Hi {{customerName}}, {{businessName}} received your request.",
    fallback: buildMissedCallRecoveryFallback({ businessName: "Khan Automation Systems" }),
    values: {
      customerName: "Casey",
      businessName: "Khan Automation Systems"
    }
  });
  assert.match(message, /^Hi Casey, Khan Automation Systems received your request\./);
  assert.match(message, /Reply STOP to unsubscribe\./);
});

test("appointment slot offer fallback keeps the conversation in booking language", () => {
  const message = buildAppointmentSlotOfferFallback({
    businessName: "Khan Automation Systems",
    customerName: "Taylor",
    slotLines: "1. Tue 3:00 PM\n2. Wed 10:00 AM"
  });
  assert.match(message, /scheduling options/i);
  assert.match(message, /Reply with the option that works best/i);
  assert.match(message, /team will confirm the booking/i);
});
