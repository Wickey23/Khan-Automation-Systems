const dotenv = require("dotenv");
dotenv.config();

const BASE_URL = "https://api.vapi.ai";
const BACKEND_BASE = "https://ai-auto-apply.onrender.com";

const REQUIRED_ENV = ["VAPI_PRIVATE_KEY","ORG_UUID","VAPI_TOOL_SECRET","TEST_TO_NUMBER","TRANSFER_TO"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key] || !String(process.env[key]).trim()) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}
if (typeof fetch !== "function") {
  console.error("Global fetch() not found. Use Node 18+.");
  process.exit(1);
}

const { VAPI_PRIVATE_KEY, ORG_UUID, VAPI_TOOL_SECRET, TEST_TO_NUMBER, TRANSFER_TO } = process.env;

const vapiHeaders = {
  Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
  "Content-Type": "application/json",
};

async function vapi(method, endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: vapiHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { data = { raw: await res.text().catch(() => "") }; }
  if (!res.ok) {
    console.error(`Vapi API error ${res.status} ${method} ${endpoint}`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

function buildToolDefinition({ name, description, path, properties, required }) {
  return {
    type: "apiRequest",
    method: "POST",
    url: `${BACKEND_BASE}${path}`,
    function: {
      name,
      description,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties,
        required,
      },
    },
    // Vapi-compatible auth path (instead of raw headers array/object)
    server: {
      timeoutSeconds: 20,
      secret: VAPI_TOOL_SECRET,
    },
  };
}

const TOOL_DEFS = [
  buildToolDefinition({
    name: "create_lead_from_call",
    description: "Create a lead from call intake details.",
    path: "/api/tools/create-lead-from-call",
    properties: {
      orgId: { type: "string" },
      callId: { type: "string" },
      name: { type: "string" },
      phone: { type: "string" },
      message: { type: "string" },
      urgency: { type: "string" },
      service_type_or_equipment: { type: "string" },
      preferred_time: { type: "string" },
      location: { type: "string" },
    },
    required: ["orgId", "name", "phone", "message"],
  }),
  buildToolDefinition({
    name: "notify_manager",
    description: "Notify manager of urgent or high-priority call.",
    path: "/api/tools/notify-manager",
    properties: {
      orgId: { type: "string" },
      callId: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      summary: { type: "string" },
    },
    required: ["orgId", "priority", "summary"],
  }),
  buildToolDefinition({
    name: "request_appointment",
    description: "Request appointment callback/scheduling.",
    path: "/api/tools/request-appointment",
    properties: {
      orgId: { type: "string" },
      callId: { type: "string" },
      name: { type: "string" },
      phone: { type: "string" },
      preferred_time: { type: "string" },
      service_type_or_equipment: { type: "string" },
    },
    required: ["orgId", "name", "phone", "preferred_time"],
  }),
  buildToolDefinition({
    name: "send_sms",
    description: "Send an SMS follow-up/confirmation message.",
    path: "/api/tools/send-sms",
    properties: {
      orgId: { type: "string" },
      callId: { type: "string" },
      to: { type: "string" },
      message: { type: "string" },
    },
    required: ["orgId", "to", "message"],
  }),
  buildToolDefinition({
    name: "transfer_call",
    description: "Transfer urgent call to destination number.",
    path: "/api/tools/transfer-call",
    properties: {
      orgId: { type: "string" },
      callId: { type: "string" },
      transferTo: { type: "string" },
      reason: { type: "string" },
    },
    required: ["orgId", "transferTo", "reason"],
  }),
];

function sanitizeToolForPrint(tool) {
  const headers = Array.isArray(tool.headers) ? tool.headers : [];
  const redacted = headers.map((h) =>
    String(h).toLowerCase().startsWith("x-vapi-tool-secret:")
      ? "x-vapi-tool-secret: ***REDACTED***"
      : h
  );
  return {
    id: tool.id,
    name: tool.function?.name,
    type: tool.type,
    method: tool.method,
    url: tool.url,
    headers: redacted,
    required: tool.function?.parameters?.required || [],
  };
}

function isTerminal(callObj) {
  const status = String(callObj?.status || "").toLowerCase();
  return ["ended", "failed", "canceled", "cancelled", "busy", "no-answer", "timeout"].includes(status);
}

async function pollCall(callId, timeoutMs = 240000, intervalMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const details = await vapi("GET", `/call/${callId}`);
    if (isTerminal(details)) return details;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for call ${callId} to end`);
}

function extractToolEvents(callDetails) {
  const messages = callDetails?.artifact?.messages || [];
  const events = [];
  for (const msg of messages) {
    const toolCalls = msg?.tool_calls || msg?.toolCalls || [];
    for (const tc of toolCalls) {
      const fn = tc?.function || {};
      let args = fn.arguments;
      if (typeof args === "string") { try { args = JSON.parse(args); } catch {} }
      events.push({ type: "tool_call", toolCallId: tc.id || null, name: fn.name || "unknown", arguments: args ?? {} });
    }
    if (msg?.role === "tool") {
      let content = msg?.content;
      if (typeof content === "string") { try { content = JSON.parse(content); } catch {} }
      events.push({ type: "tool_result", toolCallId: msg?.tool_call_id || msg?.toolCallId || null, output: content });
    }
  }
  return events;
}

function findIdsFromToolResults(events) {
  let leadId = null;
  let callLogId = null;
  for (const e of events) {
    if (e.type !== "tool_result") continue;
    const out = e.output;
    if (!out || typeof out !== "object") continue;
    if (!leadId) leadId = out?.data?.leadId || out?.leadId || null;
    if (!callLogId) callLogId = out?.data?.callLogId || out?.callLogId || null;
    if (leadId && callLogId) break;
  }
  return { leadId, callLogId };
}

async function main() {
  console.log("Creating 5 apiRequest tools...");
  const createdTools = [];
  for (const def of TOOL_DEFS) createdTools.push(await vapi("POST", "/tool", def));

  console.log("Creating assistant...");
  const assistant = await vapi("POST", "/assistant", {
    name: "Khan Auto - Inbound Receptionist",
    firstMessage: "Thanks for calling Khan Automation Systems. This call may be recorded for quality and follow-up. How can I help you today?",
    model: {
      provider: "openai",
      model: "gpt-4o",
      toolIds: createdTools.map((t) => t.id),
      messages: [{
        role: "system",
        content: [
          "You are an inbound AI receptionist for a local service business.",
          "Tone: direct, practical, calm. No fluff. 1-3 sentences.",
          "Ask one question at a time.",
          "Required intake: caller_name, callback_phone, service_type_or_equipment, issue_summary, urgency (emergency/today/this_week/flexible), preferred_time, location (if mobile).",
          "Urgent keywords: towing, no brakes, accident, stranded, smoke.",
          "Urgent handling: attempt transfer_call; ALWAYS call notify_manager on every urgent call, even if transfer succeeds.",
          "Always call create_lead_from_call before ending.",
          "Never promise fixed prices or ETAs.",
          `Tool arguments rules: always include orgId="${ORG_UUID}".`,
          "Include callId only if non-empty.",
          `For urgent transfers, use transferTo="${TRANSFER_TO}".`,
        ].join(" "),
      }],
    },
  });

  console.log("Provisioning inbound number...");
  const phone = await vapi("POST", "/phone-number", { provider: "vapi", assistantId: assistant.id });

  let phoneFetched = phone;
  try { phoneFetched = await vapi("GET", `/phone-number/${phone.id}`); } catch {}
  const attachedOk = phoneFetched.assistantId === assistant.id;

  console.log("Triggering test call...");
  const call = await vapi("POST", "/call", {
    assistantId: assistant.id,
    phoneNumberId: phone.id,
    customer: { number: TEST_TO_NUMBER },
  });

  console.log("Polling call status...");
  const callDetails = await pollCall(call.id, 240000, 3000);
  const toolEvents = extractToolEvents(callDetails);
  const { leadId, callLogId } = findIdsFromToolResults(toolEvents);

  console.log("\n===== DEPLOYMENT RESULTS =====");
  console.log("Assistant ID:", assistant.id);
  console.log("Phone number (E.164):", phoneFetched.number || "(not returned)");
  console.log("Vapi Call ID:", call.id);

  console.log("\nTool IDs + names:");
  for (const t of createdTools) console.log(`- ${t.id} (${t.function?.name || "unknown"})`);

  console.log("\nSanitized Tool Configs:");
  for (const t of createdTools) console.log(JSON.stringify(sanitizeToolForPrint(t), null, 2));

  console.log("\nConfirmations:");
  console.log("Phone number attached to assistant:", attachedOk ? "YES" : "NO");
  console.log("Org UUID used in prompt:", ORG_UUID);
  console.log("transferTo configured:", TRANSFER_TO);

  console.log("\nTool Call Sequence:");
  if (!toolEvents.length) console.log("(no tool events found in call artifact.messages)");
  else {
    toolEvents.forEach((e, idx) => {
      if (e.type === "tool_call") console.log(`${idx + 1}. CALL ${e.name} (${e.toolCallId || "no-id"})`);
      else console.log(`${idx + 1}. RESULT (${e.toolCallId || "no-id"})`);
    });
  }

  console.log("\nDerived IDs:");
  console.log("Call log ID:", callLogId || "(not returned by tool responses)");
  console.log("Lead ID:", leadId || "(not returned by tool responses)");

  console.log("\nCall Ended Reason:", callDetails.endedReason || "(none)");
  console.log("Call Status:", callDetails.status || "(unknown)");
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
