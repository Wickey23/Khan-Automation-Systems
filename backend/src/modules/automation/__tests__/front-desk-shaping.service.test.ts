import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadFrontDesk, buildOrgCallFrontDesk } from "../front-desk-shaping.service";

test("buildOrgCallFrontDesk prefers persisted structured fields and flags missed calls for callback", () => {
  const result = buildOrgCallFrontDesk({
    call: {
      fromNumber: "+15555550123",
      outcome: "MISSED",
      aiSummary: "Caller said the furnace stopped working overnight.",
      transcript: "Caller needs help with a broken furnace.",
      unansweredTransfer: false
    },
    lead: {
      name: "Unknown",
      serviceRequested: "General question",
      urgency: "normal"
    },
    serviceRequest: {
      customerName: "Morgan Lee",
      serviceType: "No heat / furnace repair",
      urgency: "urgent",
      serviceAddress: "12 Oak St",
      appointmentRequested: true,
      status: "NEW"
    }
  });

  assert.equal(result.callerName, "Morgan Lee");
  assert.equal(result.serviceRequested, "No heat / furnace repair");
  assert.equal(result.urgency, "urgent");
  assert.equal(result.serviceLocation, "12 Oak St");
  assert.equal(result.appointmentRequested, true);
  assert.equal(result.followUpState, "needs_follow_up");
  assert.equal(result.needsFollowUp, true);
  assert.equal(result.frontDeskPriority, "urgent");
  assert.equal(result.recommendedAction, "Call back now");
});

test("buildOrgCallFrontDesk marks booked and spam calls with terminal actions", () => {
  const booked = buildOrgCallFrontDesk({
    call: {
      fromNumber: "+15555550124",
      outcome: "APPOINTMENT_REQUEST",
      aiSummary: "Customer wants a service visit."
    },
    appointmentRequest: {
      status: "SCHEDULED",
      issueSummary: "Water heater replacement"
    }
  });
  assert.equal(booked.followUpState, "booked");
  assert.equal(booked.frontDeskPriority, "low");
  assert.equal(booked.recommendedAction, "Confirm booking");

  const spam = buildOrgCallFrontDesk({
    call: {
      fromNumber: "+15555550125",
      outcome: "SPAM",
      transcript: "Spam message"
    }
  });
  assert.equal(spam.followUpState, "spam");
  assert.equal(spam.frontDeskPriority, "low");
  assert.equal(spam.recommendedAction, "Ignore");
});

test("buildLeadFrontDesk maps open work, booked work, and latest activity deterministically", () => {
  const followUpLead = buildLeadFrontDesk({
    lead: {
      name: "Taylor",
      phone: "+15555550126",
      serviceRequested: "Leak under sink",
      createdAt: "2026-03-10T12:00:00.000Z"
    },
    latestCall: {
      fromNumber: "+15555550126",
      outcome: "MISSED",
      startedAt: "2026-03-10T12:10:00.000Z"
    },
    latestMessageThread: {
      lastMessageAt: "2026-03-10T12:30:00.000Z"
    }
  });
  assert.equal(followUpLead.state, "needs_follow_up");
  assert.equal(followUpLead.frontDeskPriority, "high");
  assert.equal(followUpLead.recommendedAction, "Call back now");
  assert.equal(followUpLead.lastActivityType, "message");

  const bookedLead = buildLeadFrontDesk({
    lead: {
      name: "Jordan",
      phone: "+15555550127",
      pipelineStage: "SCHEDULED",
      serviceRequested: "AC tune-up"
    },
    appointmentRequest: {
      status: "SCHEDULED",
      issueSummary: "AC tune-up"
    }
  });
  assert.equal(bookedLead.state, "booked");
  assert.equal(bookedLead.frontDeskPriority, "low");
  assert.equal(bookedLead.recommendedAction, "Confirm booking");
});
