import {
  AiActionStatus,
  AppointmentStatus,
  LeadStatus,
  MessageDirection,
  TaskPriority,
  TaskSource,
  TaskStatus,
  UserRole
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { refreshEntityOperationalMemory } from "../context/entity-state-refresh.service";
import type { ToolDefinition } from "./tool.interface";

const OPERATOR_ROLES = [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF];

function ok(message: string, output?: Record<string, unknown>, outputSummary?: string) {
  return {
    ok: true,
    status: AiActionStatus.EXECUTED,
    message,
    output,
    outputSummary: outputSummary || message
  };
}

function fail(message: string, outputSummary?: string) {
  return {
    ok: false,
    status: AiActionStatus.FAILED,
    message,
    outputSummary: outputSummary || message
  };
}

function cleanText(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tokenize(text: string) {
  return cleanText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function scoreKeywordHits(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.reduce((sum, word) => (lower.includes(word) ? sum + 1 : sum), 0);
}

function coerceDays(days: number | undefined) {
  const bounded = Number.isFinite(days) ? Math.max(1, Math.min(30, Number(days))) : 7;
  return bounded;
}

function toIso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

async function findLead(orgId: string, leadId?: string) {
  if (!leadId) return null;
  return prisma.lead.findFirst({ where: { id: leadId, orgId } });
}

async function findCall(orgId: string, callId?: string) {
  if (!callId) return null;
  return prisma.callLog.findFirst({ where: { id: callId, orgId }, include: { lead: true } });
}

async function findThread(orgId: string, threadId?: string) {
  if (!threadId) return null;
  return prisma.messageThread.findFirst({
    where: { id: threadId, orgId },
    include: { lead: true, messages: { orderBy: { createdAt: "desc" }, take: 25 } }
  });
}

const summarizeCallTool: ToolDefinition<{ callId?: string }> = {
  key: "summarize_call",
  description: "Summarize a call and persist a call AI summary record.",
  inputSchema: z.object({ callId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["call"],
  approvalPolicy: "NONE",
  idempotencyScope: "org_entity_tool",
  async execute(input, context) {
    const callId = input.callId || context.entityId;
    const call = await findCall(context.orgId, callId);
    if (!call) return fail("CALL_NOT_FOUND", "Call not found for this workspace.");

    const transcript = cleanText(call.transcript);
    const summary = transcript
      ? transcript.slice(0, 500)
      : `Call from ${call.fromNumber} to ${call.toNumber} with outcome ${call.outcome}.`;
    const urgency = scoreKeywordHits(summary, ["urgent", "asap", "immediately", "emergency"]) > 0 ? "high" : "normal";

    await prisma.$transaction([
      prisma.callAiSummary.create({
        data: {
          orgId: context.orgId,
          callLogId: call.id,
          summary,
          extractedJson: {
            urgency,
            fromNumber: call.fromNumber,
            toNumber: call.toNumber,
            durationSec: call.durationSec || null
          },
          confidence: 0.72
        }
      }),
      prisma.callLog.update({
        where: { id: call.id },
        data: { aiSummary: summary.slice(0, 1000), aiSummaryGeneratedAt: new Date() }
      })
    ]);

    return ok("CALL_SUMMARIZED", { callId: call.id, summary, urgency }, `Call summarized (${urgency} urgency).`);
  }
};

const detectUrgencyTool: ToolDefinition<{ callId?: string; text?: string }> = {
  key: "detect_urgency",
  description: "Detect urgency from call transcript/body text.",
  inputSchema: z.object({ callId: z.string().optional(), text: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["call", "lead", "message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    let body = cleanText(input.text);
    if (!body) {
      const call = await findCall(context.orgId, input.callId || context.entityId);
      body = cleanText(call?.transcript) || cleanText(call?.aiSummary);
    }
    if (!body) return fail("NO_CONTENT", "No content available for urgency detection.");

    const score = scoreKeywordHits(body, ["urgent", "asap", "immediately", "emergency", "leak", "broken", "stuck"]);
    const urgency = score >= 3 ? "high" : score >= 1 ? "medium" : "low";
    return ok("URGENCY_DETECTED", { urgency, score }, `Urgency detected: ${urgency}.`);
  }
};

const draftCallbackTool: ToolDefinition<{ callId?: string; tone?: string }> = {
  key: "draft_callback",
  description: "Draft a callback SMS based on a call record.",
  inputSchema: z.object({ callId: z.string().optional(), tone: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["call", "lead"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const call = await findCall(context.orgId, input.callId || context.entityId);
    if (!call) return fail("CALL_NOT_FOUND", "Call not found.");
    const name = cleanText(call.lead?.name) || "there";
    const draft = `Hi ${name}, this is ${call.toNumber}. Sorry we missed your call. Reply with a good time and we will call you back shortly.`;
    return ok("CALLBACK_DRAFTED", { draft, callId: call.id }, "Callback draft generated.");
  }
};

const extractCallDetailsTool: ToolDefinition<{ callId?: string }> = {
  key: "extract_call_details",
  description: "Extract basic details from call context.",
  inputSchema: z.object({ callId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["call"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const call = await findCall(context.orgId, input.callId || context.entityId);
    if (!call) return fail("CALL_NOT_FOUND");
    const text = cleanText(call.transcript || call.aiSummary);
    const likelyBooking = scoreKeywordHits(text, ["appointment", "book", "schedule"]) > 0 || call.appointmentRequested;
    return ok(
      "CALL_DETAILS_EXTRACTED",
      {
        callId: call.id,
        fromNumber: call.fromNumber,
        outcome: call.outcome,
        durationSec: call.durationSec || null,
        likelyBooking
      },
      "Call details extracted."
    );
  }
};

const classifyCallIntentTool: ToolDefinition<{ callId?: string; text?: string }> = {
  key: "classify_call_intent",
  description: "Classify primary call intent from transcript and call outcome.",
  inputSchema: z.object({ callId: z.string().optional(), text: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["call"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const call = await findCall(context.orgId, input.callId || context.entityId);
    if (!call) return fail("CALL_NOT_FOUND");
    const text = cleanText(input.text || call.transcript || call.aiSummary);
    const intent = scoreKeywordHits(text, ["book", "appointment", "schedule"]) > 0 || call.outcome === "APPOINTMENT_REQUEST"
      ? "booking_request"
      : scoreKeywordHits(text, ["support", "help", "issue", "problem"]) > 0
        ? "support_request"
        : scoreKeywordHits(text, ["quote", "price", "cost"]) > 0
          ? "quote_request"
          : call.outcome === "SPAM"
            ? "spam"
            : "general_inquiry";

    await prisma.callAiSummary.create({
      data: {
        orgId: context.orgId,
        callLogId: call.id,
        summary: `Classified intent: ${intent}`,
        extractedJson: { intent },
        confidence: 0.68
      }
    });

    return ok("CALL_INTENT_CLASSIFIED", { callId: call.id, intent }, `Call intent classified as ${intent}.`);
  }
};

const suggestFrontDeskActionTool: ToolDefinition<{ callId?: string }> = {
  key: "suggest_front_desk_action",
  description: "Suggest next operator action based on call outcome and context.",
  inputSchema: z.object({ callId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["call"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const call = await findCall(context.orgId, input.callId || context.entityId);
    if (!call) return fail("CALL_NOT_FOUND");
    const transcript = cleanText(call.transcript || call.aiSummary);
    const action =
      call.outcome === "APPOINTMENT_REQUEST" || scoreKeywordHits(transcript, ["appointment", "book"]) > 0
        ? "Open booking triage and confirm appointment slot."
        : call.outcome === "MISSED" || call.outcome === "ABANDONED"
          ? "Send callback draft and create follow-up task."
          : scoreKeywordHits(transcript, ["quote", "price"]) > 0
            ? "Create quote follow-up task for lead ops."
            : "Review transcript and close with notes.";
    return ok("FRONT_DESK_ACTION_SUGGESTED", { callId: call.id, action }, "Front desk next action suggested.");
  }
};

const createFollowupTaskTool: ToolDefinition<{ title?: string; description?: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" }> = {
  key: "create_followup_task",
  description: "Create a follow-up task and queue item.",
  inputSchema: z
    .object({
      title: z.string().min(3).max(180).optional(),
      description: z.string().max(2000).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional()
    })
    .passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["call", "message_thread", "lead", "appointment", "task", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const title = cleanText(input.title) || `Follow up on ${context.entityType || "customer"} item`;
    const priority = (input.priority as TaskPriority | undefined) || TaskPriority.MEDIUM;

    const task = await prisma.task.create({
      data: {
        orgId: context.orgId,
        title,
        description: cleanText(input.description) || context.prompt.slice(0, 1000),
        priority,
        source: TaskSource.AI_AGENT,
        entityType: context.entityType || null,
        entityId: context.entityId || null,
        createdByUserId: context.actorUserId
      }
    });

    await prisma.followUpQueueItem.create({
      data: {
        orgId: context.orgId,
        taskId: task.id,
        entityType: task.entityType,
        entityId: task.entityId,
        reason: "AI follow-up recommendation",
        status: "OPEN",
        suggestedAt: new Date(),
        createdByAgentRunId: null
      }
    });

    return ok("FOLLOWUP_TASK_CREATED", { taskId: task.id }, "Follow-up task created.");
  }
};

const createTaskTool: ToolDefinition<{ title: string; description?: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" }> = {
  key: "create_task",
  description: "Create a task for follow-up workflows.",
  inputSchema: z
    .object({
      title: z.string().min(3).max(180),
      description: z.string().max(2000).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional()
    })
    .passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["call", "message_thread", "lead", "appointment", "task", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    return createFollowupTaskTool.execute(
      { title: input.title, description: input.description, priority: input.priority },
      context
    );
  }
};

const suggestDueDateTool: ToolDefinition<{ priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" }> = {
  key: "suggest_due_date",
  description: "Suggest a due date based on priority.",
  inputSchema: z.object({ priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["task", "call", "message_thread", "lead", "appointment", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input) {
    const now = Date.now();
    const priority = input.priority || "MEDIUM";
    const offsetMs =
      priority === "URGENT" ? 2 * 60 * 60 * 1000 : priority === "HIGH" ? 8 * 60 * 60 * 1000 : priority === "LOW" ? 3 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const dueAt = new Date(now + offsetMs);
    return ok("DUE_DATE_SUGGESTED", { dueAt: dueAt.toISOString() }, `Suggested due date: ${dueAt.toISOString()}`);
  }
};

const createReminderTool: ToolDefinition<{ taskId: string; remindAt?: string }> = {
  key: "create_reminder",
  description: "Create reminder for an existing task.",
  inputSchema: z.object({ taskId: z.string().min(1), remindAt: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["task"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const task = await prisma.task.findFirst({ where: { id: input.taskId, orgId: context.orgId } });
    if (!task) return fail("TASK_NOT_FOUND");
    const remindAt = input.remindAt ? new Date(input.remindAt) : new Date(Date.now() + 2 * 60 * 60 * 1000);
    const reminder = await prisma.taskReminder.create({ data: { orgId: context.orgId, taskId: task.id, remindAt } });
    return ok("REMINDER_CREATED", { reminderId: reminder.id, remindAt: remindAt.toISOString() }, "Reminder created.");
  }
};

const scheduleFollowupTool: ToolDefinition<{ reason?: string }> = {
  key: "schedule_followup",
  description: "Add follow-up queue item for the current entity.",
  inputSchema: z.object({ reason: z.string().max(300).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["call", "message_thread", "lead", "appointment", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const item = await prisma.followUpQueueItem.create({
      data: {
        orgId: context.orgId,
        entityType: context.entityType || null,
        entityId: context.entityId || null,
        reason: cleanText(input.reason) || "AI follow-up suggested",
        status: "OPEN",
        suggestedAt: new Date()
      }
    });
    return ok("FOLLOWUP_QUEUED", { queueItemId: item.id }, "Follow-up queued.");
  }
};

const assignTaskTool: ToolDefinition<{ taskId: string; assigneeUserId: string }> = {
  key: "assign_task",
  description: "Assign a task to a user in the same workspace.",
  inputSchema: z.object({ taskId: z.string().min(1), assigneeUserId: z.string().min(1) }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["task"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const [task, user] = await Promise.all([
      prisma.task.findFirst({ where: { id: input.taskId, orgId: context.orgId } }),
      prisma.user.findFirst({ where: { id: input.assigneeUserId, orgId: context.orgId } })
    ]);
    if (!task) return fail("TASK_NOT_FOUND");
    if (!user) return fail("ASSIGNEE_NOT_FOUND");
    await prisma.task.update({ where: { id: task.id }, data: { assignedToUserId: user.id, status: TaskStatus.IN_PROGRESS } });
    return ok("TASK_ASSIGNED", { taskId: task.id, assigneeUserId: user.id }, "Task assigned.");
  }
};

const buildCallbackQueueTool: ToolDefinition<{ limit?: number }> = {
  key: "build_callback_queue",
  description: "Build callback queue from recent missed/abandoned calls.",
  inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization", "call"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const limit = Math.max(1, Math.min(100, Number(input.limit || 20)));
    const calls = await prisma.callLog.findMany({
      where: { orgId: context.orgId, outcome: { in: ["MISSED", "ABANDONED"] } },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    let created = 0;
    for (const call of calls) {
      const existing = await prisma.followUpQueueItem.findFirst({
        where: { orgId: context.orgId, entityType: "call", entityId: call.id, status: "OPEN" }
      });
      if (existing) continue;
      await createFollowupTaskTool.execute(
        {
          title: `Callback needed: ${call.fromNumber}`,
          description: `Missed call at ${call.createdAt.toISOString()} from ${call.fromNumber}`,
          priority: "HIGH"
        },
        { ...context, entityType: "call", entityId: call.id }
      );
      created += 1;
    }
    return ok("CALLBACK_QUEUE_BUILT", { created, inspected: calls.length }, `Callback queue built with ${created} new items.`);
  }
};

const escalateOverdueItemTool: ToolDefinition<{ taskId?: string }> = {
  key: "escalate_overdue_item",
  description: "Escalate overdue task priority and queue note.",
  inputSchema: z.object({ taskId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["task", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const taskId = input.taskId || context.entityId;
    if (!taskId) return fail("TASK_NOT_FOUND");
    const task = await prisma.task.findFirst({ where: { id: taskId, orgId: context.orgId } });
    if (!task) return fail("TASK_NOT_FOUND");
    const overdue = Boolean(task.dueAt && task.dueAt.getTime() < Date.now() && task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELED);
    if (!overdue) return ok("TASK_NOT_OVERDUE", { taskId: task.id }, "Task is not overdue.");
    await prisma.task.update({
      where: { id: task.id },
      data: {
        priority: TaskPriority.URGENT,
        status: task.status === TaskStatus.OPEN ? TaskStatus.BLOCKED : task.status,
        description: `${task.description || ""}\n[AI Escalation] Overdue item escalated on ${new Date().toISOString()}`.trim()
      }
    });
    await prisma.followUpQueueItem.create({
      data: {
        orgId: context.orgId,
        taskId: task.id,
        entityType: task.entityType,
        entityId: task.entityId,
        reason: "Overdue follow-up item escalated by AI agent",
        status: "OPEN",
        suggestedAt: new Date()
      }
    });
    return ok("OVERDUE_ITEM_ESCALATED", { taskId: task.id }, "Overdue task escalated.");
  }
};

const scoreLeadTool: ToolDefinition<{ leadId?: string }> = {
  key: "score_lead",
  description: "Score lead quality and persist lightweight pipeline record.",
  inputSchema: z.object({ leadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead"],
  approvalPolicy: "NONE",
  idempotencyScope: "org_entity_tool",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    const completeness = [lead.name, lead.phone, lead.email, lead.message, lead.serviceRequested].filter((x) => cleanText(x).length > 0).length;
    const urgency = scoreKeywordHits(`${lead.message || ""} ${lead.urgency || ""}`, ["urgent", "asap", "today", "emergency"]);
    const score = Math.max(0, Math.min(100, completeness * 18 + urgency * 8 + (lead.appointmentRequested ? 12 : 0)));
    const confidence = Number((score / 100).toFixed(2));
    const existing = await prisma.pipelineRecord.findFirst({ where: { orgId: context.orgId, leadId: lead.id } });
    if (existing) {
      await prisma.pipelineRecord.update({
        where: { id: existing.id },
        data: { stage: score >= 70 ? "QUALIFIED" : "NEW", confidence, summary: `Lead score ${score}/100`, isStale: false, staleReason: null }
      });
    } else {
      await prisma.pipelineRecord.create({
        data: { orgId: context.orgId, leadId: lead.id, stage: score >= 70 ? "QUALIFIED" : "NEW", confidence, summary: `Lead score ${score}/100` }
      });
    }

    return ok("LEAD_SCORED", { leadId: lead.id, score, confidence }, `Lead scored ${score}/100.`);
  }
};

const summarizeLeadTool: ToolDefinition<{ leadId?: string }> = {
  key: "summarize_lead",
  description: "Create a concise lead summary.",
  inputSchema: z.object({ leadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    const summary = `${lead.name} (${lead.business}) requested ${lead.serviceRequested || "service"} via ${lead.source}. Status: ${lead.status}.`;
    return ok("LEAD_SUMMARIZED", { leadId: lead.id, summary }, "Lead summary generated.");
  }
};

const draftOutreachEmailTool: ToolDefinition<{ leadId?: string; objective?: string }> = {
  key: "draft_outreach_email",
  description: "Draft outbound email copy for a lead.",
  inputSchema: z.object({ leadId: z.string().optional(), objective: z.string().max(200).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    const subject = `Following up on ${lead.serviceRequested || "your request"}`;
    const body = `Hi ${lead.name},\n\nThanks for reaching out to ${lead.business}. We can help with ${lead.serviceRequested || "your request"}.\nWould you like to schedule a quick call this week?\n\nBest,\nFront Desk Team`;
    return ok("OUTREACH_EMAIL_DRAFTED", { leadId: lead.id, subject, body }, "Outreach email draft generated.");
  }
};

const draftOutreachSmsTool: ToolDefinition<{ leadId?: string }> = {
  key: "draft_outreach_sms",
  description: "Draft outbound SMS copy for a lead.",
  inputSchema: z.object({ leadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    const draft = `Hi ${lead.name}, this is Front Desk OS. We can help with ${lead.serviceRequested || "your request"}. Want to book a quick call?`;
    return ok("OUTREACH_SMS_DRAFTED", { leadId: lead.id, draft }, "Outreach SMS draft generated.");
  }
};

const generateCallPrepTool: ToolDefinition<{ leadId?: string }> = {
  key: "generate_call_prep",
  description: "Generate short call prep checklist.",
  inputSchema: z.object({ leadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    const checklist = [
      `Confirm service requested: ${lead.serviceRequested || "not provided"}`,
      `Confirm location: ${lead.serviceAddress || "not provided"}`,
      "Confirm preferred appointment window",
      "Confirm callback number and consent for SMS follow-up"
    ];
    return ok("CALL_PREP_GENERATED", { leadId: lead.id, checklist }, "Call prep generated.");
  }
};

const previewImportTool: ToolDefinition<{ csv: string; mapping?: Record<string, string> }> = {
  key: "preview_import",
  description: "Preview CSV lead import and basic column mapping.",
  inputSchema: z.object({ csv: z.string().min(5), mapping: z.record(z.string()).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input) {
    const rows = input.csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (rows.length < 2) return fail("IMPORT_PREVIEW_EMPTY", "CSV must include header and at least one row.");

    const headers = rows[0].split(",").map((item) => item.trim());
    const sampleRows = rows.slice(1, 6).map((line) => line.split(",").map((cell) => cell.trim()));
    const suggestedMapping: Record<string, string> = {};
    for (const header of headers) {
      const lower = header.toLowerCase();
      if (lower.includes("name")) suggestedMapping[header] = "name";
      if (lower.includes("company") || lower.includes("business")) suggestedMapping[header] = "business";
      if (lower.includes("email")) suggestedMapping[header] = "email";
      if (lower.includes("phone")) suggestedMapping[header] = "phone";
      if (lower.includes("service")) suggestedMapping[header] = "serviceRequested";
      if (lower.includes("message") || lower.includes("note")) suggestedMapping[header] = "message";
    }
    return ok(
      "IMPORT_PREVIEW_READY",
      { headers, sampleRows, totalRows: rows.length - 1, suggestedMapping, mapping: input.mapping || suggestedMapping },
      `Import preview ready for ${rows.length - 1} rows.`
    );
  }
};

const importLeadsTool: ToolDefinition<{ csv: string; mapping?: Record<string, string> }> = {
  key: "import_leads",
  description: "Import leads from CSV into workspace lead table.",
  inputSchema: z.object({ csv: z.string().min(5), mapping: z.record(z.string()).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const preview = await previewImportTool.execute(input, context);
    if (!preview.ok) return preview;
    const headers = (preview.output?.headers as string[]) || [];
    const mapping = ((preview.output?.mapping as Record<string, string>) || {});
    const rows = input.csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1);

    let imported = 0;
    let skipped = 0;
    for (const row of rows.slice(0, 500)) {
      const cells = row.split(",").map((cell) => cell.trim());
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[mapping[header] || header] = cells[index] || "";
      });
      const name = cleanText(record.name);
      const email = cleanText(record.email);
      const phone = cleanText(record.phone);
      if (!name || (!email && !phone)) {
        skipped += 1;
        continue;
      }
      const existing = await prisma.lead.findFirst({
        where: {
          orgId: context.orgId,
          OR: [{ email: email || "__none__" }, { phone: phone || "__none__" }]
        }
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.lead.create({
        data: {
          orgId: context.orgId,
          name,
          business: cleanText(record.business) || "Imported Lead",
          email: email || `${phone.replace(/\D/g, "") || "unknown"}@import.local`,
          phone: phone || "unknown",
          message: cleanText(record.message) || null,
          serviceRequested: cleanText(record.serviceRequested) || null,
          sourcePage: "ai-import",
          source: "WEB_FORM"
        }
      });
      imported += 1;
    }

    return ok("LEADS_IMPORTED", { imported, skipped }, `Imported ${imported} leads, skipped ${skipped}.`);
  }
};

const dedupeLeadsTool: ToolDefinition<Record<string, unknown>> = {
  key: "dedupe_leads",
  description: "Find duplicate leads by normalized email/phone.",
  inputSchema: z.object({}).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(_, context) {
    const leads = await prisma.lead.findMany({
      where: { orgId: context.orgId },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
      take: 1000
    });
    const byKey = new Map<string, Array<{ id: string; name: string; createdAt: Date }>>();
    for (const lead of leads) {
      const normalized = `${lead.email.toLowerCase()}|${lead.phone.replace(/\D/g, "")}`;
      if (!byKey.has(normalized)) byKey.set(normalized, []);
      byKey.get(normalized)!.push({ id: lead.id, name: lead.name, createdAt: lead.createdAt });
    }
    const duplicates = [...byKey.values()]
      .filter((group) => group.length > 1)
      .map((group) => group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    return ok(
      "LEAD_DEDUPE_ANALYZED",
      {
        duplicateGroups: duplicates.map((group) => ({ canonicalId: group[0].id, members: group.map((item) => ({ id: item.id, name: item.name })) })),
        duplicateCount: duplicates.reduce((sum, group) => sum + group.length - 1, 0)
      },
      `${duplicates.length} duplicate groups identified.`
    );
  }
};

const classifyLeadReplyTool: ToolDefinition<{ leadId?: string; text?: string }> = {
  key: "classify_lead_reply",
  description: "Classify inbound lead reply for pipeline follow-up.",
  inputSchema: z.object({ leadId: z.string().optional(), text: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead", "message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    let text = cleanText(input.text);
    if (!text) {
      const latestThread = await prisma.messageThread.findFirst({
        where: { orgId: context.orgId, leadId: lead.id },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } }
      });
      text = cleanText(latestThread?.messages[0]?.body);
    }
    if (!text) return fail("NO_REPLY_TEXT", "No reply text found for classification.");
    const classification = scoreKeywordHits(text, ["yes", "available", "schedule"]) > 0
      ? "interested"
      : scoreKeywordHits(text, ["later", "next week", "not now"]) > 0
        ? "nurture"
        : scoreKeywordHits(text, ["stop", "unsubscribe", "no thanks"]) > 0
          ? "do_not_contact"
          : "needs_review";
    const recommendation =
      classification === "interested"
        ? "Schedule follow-up call within 24 hours."
        : classification === "nurture"
          ? "Set follow-up reminder for next week."
          : classification === "do_not_contact"
            ? "Mark lead DNC and stop outreach."
            : "Review manually.";
    return ok("LEAD_REPLY_CLASSIFIED", { leadId: lead.id, classification, recommendation }, `Lead reply classified as ${classification}.`);
  }
};

const scheduleLeadFollowupTool: ToolDefinition<{ leadId?: string; reason?: string }> = {
  key: "schedule_lead_followup",
  description: "Create lead-linked follow-up task in queue.",
  inputSchema: z.object({ leadId: z.string().optional(), reason: z.string().max(300).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    return createFollowupTaskTool.execute(
      {
        title: `Lead follow-up: ${lead.name}`,
        description: cleanText(input.reason) || "AI scheduled lead follow-up task.",
        priority: "MEDIUM"
      },
      { ...context, entityType: "lead", entityId: lead.id }
    );
  }
};

const classifyMessageTool: ToolDefinition<{ threadId?: string }> = {
  key: "classify_message",
  description: "Classify a message thread and persist classification.",
  inputSchema: z.object({ threadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "org_entity_tool",
  async execute(input, context) {
    const thread = await findThread(context.orgId, input.threadId || context.entityId);
    if (!thread) return fail("THREAD_NOT_FOUND");
    const lastInbound = thread.messages.find((m) => m.direction === MessageDirection.INBOUND);
    const text = cleanText(lastInbound?.body);
    const classification = scoreKeywordHits(text, ["book", "appointment", "schedule"]) > 0 ? "BOOKING" : scoreKeywordHits(text, ["price", "quote", "cost"]) > 0 ? "QUOTE" : "GENERAL";
    const confidence = classification === "GENERAL" ? 0.61 : 0.78;

    await prisma.threadClassification.create({
      data: {
        orgId: context.orgId,
        threadId: thread.id,
        classification,
        confidence,
        rationale: `Derived from recent inbound message tokens (${tokenize(text).slice(0, 8).join(", ")}).`
      }
    });

    return ok("THREAD_CLASSIFIED", { threadId: thread.id, classification, confidence }, `Thread classified as ${classification}.`);
  }
};

const summarizeThreadTool: ToolDefinition<{ threadId?: string }> = {
  key: "summarize_thread",
  description: "Summarize recent message thread context.",
  inputSchema: z.object({ threadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const thread = await findThread(context.orgId, input.threadId || context.entityId);
    if (!thread) return fail("THREAD_NOT_FOUND");
    const recent = thread.messages
      .slice(0, 6)
      .reverse()
      .map((m) => `${m.direction === MessageDirection.INBOUND ? "Customer" : "Team"}: ${cleanText(m.body).slice(0, 120)}`)
      .join(" | ");
    const summary = recent || `No recent messages for ${thread.contactPhone}.`;
    await prisma.messageAiSummary.create({ data: { orgId: context.orgId, threadId: thread.id, summary, confidence: 0.7 } });
    return ok("THREAD_SUMMARIZED", { threadId: thread.id, summary }, "Thread summary generated.");
  }
};

const detectOptOutTool: ToolDefinition<{ threadId?: string; text?: string }> = {
  key: "detect_opt_out",
  description: "Detect opt-out intent in inbound message content.",
  inputSchema: z.object({ threadId: z.string().optional(), text: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["message_thread", "lead"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    let text = cleanText(input.text);
    let threadLeadId: string | null = null;
    let threadId: string | null = null;
    if (!text) {
      const thread = await findThread(context.orgId, input.threadId || context.entityId);
      threadLeadId = thread?.leadId || null;
      threadId = thread?.id || null;
      text = cleanText(thread?.messages.find((m) => m.direction === MessageDirection.INBOUND)?.body);
    }
    if (!text) return fail("NO_CONTENT", "No inbound message text to inspect.");
    const optOutKeywords = ["stop", "unsubscribe", "do not text", "dont text", "remove me"];
    const optedOut = optOutKeywords.some((k) => text.toLowerCase().includes(k));
    if (optedOut && threadLeadId) {
      await prisma.lead.update({ where: { id: threadLeadId }, data: { dnc: true, notes: "Opt-out detected by communications agent." } });
    }
    if (threadId) {
      await refreshEntityOperationalMemory({
        orgId: context.orgId,
        entityType: "message_thread",
        entityId: threadId,
        updatedByUserId: context.actorUserId,
        reason: optedOut ? "opt_out_detected" : "opt_out_checked"
      });
    }
    if (threadLeadId) {
      await refreshEntityOperationalMemory({
        orgId: context.orgId,
        entityType: "lead",
        entityId: threadLeadId,
        updatedByUserId: context.actorUserId,
        reason: optedOut ? "lead_dnc_updated" : "lead_opt_out_checked"
      });
    }
    return ok("OPT_OUT_CHECKED", { optedOut }, optedOut ? "Opt-out intent detected." : "No opt-out intent detected.");
  }
};

const draftReplyTool: ToolDefinition<{ threadId?: string; tone?: string }> = {
  key: "draft_reply",
  description: "Draft a reply for a thread without sending.",
  inputSchema: z.object({ threadId: z.string().optional(), tone: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const thread = await findThread(context.orgId, input.threadId || context.entityId);
    if (!thread) return fail("THREAD_NOT_FOUND");
    const inbound = thread.messages.find((m) => m.direction === MessageDirection.INBOUND);
    const message = cleanText(inbound?.body);
    const draft = message
      ? `Thanks for the update. We received: "${message.slice(0, 120)}". We can help and will follow up shortly with next steps.`
      : "Thanks for reaching out. We will follow up shortly with next steps.";
    return ok("REPLY_DRAFTED", { threadId: thread.id, draft }, "Reply draft generated.");
  }
};

const createMessageFollowupTaskTool: ToolDefinition<{ threadId?: string }> = {
  key: "create_message_followup_task",
  description: "Create follow-up task from message thread context.",
  inputSchema: z.object({ threadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const thread = await findThread(context.orgId, input.threadId || context.entityId);
    if (!thread) return fail("THREAD_NOT_FOUND");
    return createFollowupTaskTool.execute(
      {
        title: `Follow up message thread ${thread.contactPhone}`,
        description: "AI requested message follow-up task.",
        priority: "MEDIUM"
      },
      { ...context, entityType: "message_thread", entityId: thread.id }
    );
  }
};

const routeThreadTool: ToolDefinition<{ threadId?: string; routeTo?: string }> = {
  key: "route_thread",
  description: "Route thread to an operational queue via follow-up item.",
  inputSchema: z.object({ threadId: z.string().optional(), routeTo: z.string().max(80).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const thread = await findThread(context.orgId, input.threadId || context.entityId);
    if (!thread) return fail("THREAD_NOT_FOUND");
    const routeTo = cleanText(input.routeTo) || "front-desk-review";
    const queueItem = await prisma.followUpQueueItem.create({
      data: {
        orgId: context.orgId,
        entityType: "message_thread",
        entityId: thread.id,
        reason: `Thread routed to ${routeTo}`,
        status: "OPEN",
        suggestedAt: new Date()
      }
    });
    return ok("THREAD_ROUTED", { threadId: thread.id, routeTo, queueItemId: queueItem.id }, `Thread routed to ${routeTo}.`);
  }
};

const markThreadStatusTool: ToolDefinition<{ threadId?: string; status: "OPEN" | "PENDING" | "RESOLVED" | "BLOCKED" }> = {
  key: "mark_thread_status",
  description: "Mark thread operational status in metadata.",
  inputSchema: z.object({ threadId: z.string().optional(), status: z.enum(["OPEN", "PENDING", "RESOLVED", "BLOCKED"]) }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "org_entity_tool",
  async execute(input, context) {
    const thread = await prisma.messageThread.findFirst({ where: { id: input.threadId || context.entityId, orgId: context.orgId } });
    if (!thread) return fail("THREAD_NOT_FOUND");
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date(), contactName: thread.contactName || null }
    });
    await prisma.entityNote.create({
      data: {
        orgId: context.orgId,
        entityType: "message_thread",
        entityId: thread.id,
        noteType: "thread_status",
        body: `Thread status marked ${input.status}`,
        createdByUserId: context.actorUserId
      }
    });
    return ok("THREAD_STATUS_MARKED", { threadId: thread.id, status: input.status }, `Thread status marked ${input.status}.`);
  }
};

const fetchBusinessContextTool: ToolDefinition<Record<string, unknown>> = {
  key: "fetch_business_context",
  description: "Fetch business settings context for knowledge workflows.",
  inputSchema: z.object({}).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization", "lead", "call", "message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(_, context) {
    const [org, settings] = await Promise.all([
      prisma.organization.findUnique({ where: { id: context.orgId }, select: { id: true, name: true, industry: true, status: true } }),
      prisma.businessSettings.findUnique({ where: { orgId: context.orgId } })
    ]);
    if (!org) return fail("ORG_NOT_FOUND");
    return ok(
      "BUSINESS_CONTEXT_FETCHED",
      {
        organization: org,
        settings: settings
          ? {
              timezone: settings.timezone,
              voiceRoutingMode: settings.voiceRoutingMode,
              smsConsentText: settings.smsConsentText,
              bookingLeadTimeHours: settings.bookingLeadTimeHours,
              bookingMaxDaysAhead: settings.bookingMaxDaysAhead
            }
          : null
      },
      "Business context fetched."
    );
  }
};

const searchWorkspaceKnowledgeTool: ToolDefinition<{ query?: string }> = {
  key: "search_workspace_knowledge",
  description: "Search workspace knowledge entries by text match.",
  inputSchema: z.object({ query: z.string().max(300).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization", "lead", "call", "message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const query = cleanText(input.query || context.prompt).toLowerCase();
    if (!query) return fail("QUERY_REQUIRED");
    const entries = await prisma.workspaceKnowledgeEntry.findMany({
      where: { orgId: context.orgId, OR: [{ title: { contains: query, mode: "insensitive" } }, { body: { contains: query, mode: "insensitive" } }] },
      orderBy: { updatedAt: "desc" },
      take: 10
    });
    return ok(
      "KNOWLEDGE_SEARCHED",
      { results: entries.map((e) => ({ id: e.id, title: e.title, excerpt: cleanText(e.body).slice(0, 180), updatedAt: e.updatedAt.toISOString() })) },
      `${entries.length} knowledge entries matched.`
    );
  }
};

const answerInternalQuestionTool: ToolDefinition<{ question?: string }> = {
  key: "answer_internal_question",
  description: "Answer using workspace knowledge and business settings.",
  inputSchema: z.object({ question: z.string().max(1000).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization", "lead", "call", "message_thread"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const question = cleanText(input.question || context.prompt);
    if (!question) return fail("QUESTION_REQUIRED");
    const [search, business] = await Promise.all([
      searchWorkspaceKnowledgeTool.execute({ query: question }, context),
      fetchBusinessContextTool.execute({}, context)
    ]);
    const results = (search.output?.results as Array<{ title: string; excerpt: string }> | undefined) || [];
    const answer = results.length
      ? `Based on workspace knowledge: ${results
          .slice(0, 2)
          .map((r) => `${r.title}: ${r.excerpt}`)
          .join(" | ")}`
      : "No direct knowledge entry matched. Use business settings context to answer cautiously.";
    return ok("INTERNAL_QUESTION_ANSWERED", { answer, references: results, business: business.output }, "Internal answer generated.");
  }
};

const summarizeWorkspaceActivityTool: ToolDefinition<{ days?: number }> = {
  key: "summarize_workspace_activity",
  description: "Summarize workspace activity metrics for recent period.",
  inputSchema: z.object({ days: z.number().int().min(1).max(30).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const days = coerceDays(input.days);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [callsTotal, missedCalls, messageTotal, bookingRequests, openTasks] = await Promise.all([
      prisma.callLog.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.callLog.count({ where: { orgId: context.orgId, createdAt: { gte: since }, outcome: "MISSED" } }),
      prisma.message.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.appointmentRequest.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.task.count({ where: { orgId: context.orgId, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] } } })
    ]);
    return ok(
      "WORKSPACE_ACTIVITY_SUMMARIZED",
      { days, since: since.toISOString(), callsTotal, missedCalls, messageTotal, bookingRequests, openTasks },
      `Activity (${days}d): ${callsTotal} calls, ${messageTotal} messages, ${bookingRequests} booking requests.`
    );
  }
};

const computeMissedOpportunitiesTool: ToolDefinition<{ days?: number }> = {
  key: "compute_missed_opportunities",
  description: "Estimate missed opportunities from missed calls and unresolved follow-ups.",
  inputSchema: z.object({ days: z.number().int().min(1).max(30).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const days = coerceDays(input.days);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [missedCalls, openFollowUps] = await Promise.all([
      prisma.callLog.count({ where: { orgId: context.orgId, createdAt: { gte: since }, outcome: "MISSED" } }),
      prisma.followUpQueueItem.count({ where: { orgId: context.orgId, status: "OPEN" } })
    ]);
    const riskScore = Math.min(100, missedCalls * 5 + openFollowUps * 2);
    return ok(
      "MISSED_OPPORTUNITIES_COMPUTED",
      { days, missedCalls, openFollowUps, riskScore },
      `Missed-opportunity risk score: ${riskScore}/100.`
    );
  }
};

const identifyResponseDelaysTool: ToolDefinition<{ hours?: number }> = {
  key: "identify_response_delays",
  description: "Identify threads where last inbound message has no outbound reply.",
  inputSchema: z.object({ hours: z.number().int().min(1).max(168).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const hours = Math.max(1, Math.min(168, Number(input.hours || 24)));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const threads = await prisma.messageThread.findMany({
      where: { orgId: context.orgId, lastMessageAt: { gte: since } },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 6 } },
      take: 80
    });
    const delayed = threads.filter((t) => {
      const inbound = t.messages.find((m) => m.direction === MessageDirection.INBOUND);
      const outbound = t.messages.find((m) => m.direction === MessageDirection.OUTBOUND);
      return Boolean(inbound && (!outbound || inbound.createdAt > outbound.createdAt));
    });
    return ok(
      "RESPONSE_DELAYS_IDENTIFIED",
      {
        delayedCount: delayed.length,
        sample: delayed.slice(0, 12).map((t) => ({ threadId: t.id, contactPhone: t.contactPhone, lastMessageAt: t.lastMessageAt.toISOString() }))
      },
      `Detected ${delayed.length} potentially delayed threads.`
    );
  }
};

const generateManagerReportTool: ToolDefinition<{ days?: number }> = {
  key: "generate_manager_report",
  description: "Generate concise manager report from activity and attention signals.",
  inputSchema: z.object({ days: z.number().int().min(1).max(30).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const [activity, missed, delays] = await Promise.all([
      summarizeWorkspaceActivityTool.execute({ days: input.days }, context),
      computeMissedOpportunitiesTool.execute({ days: input.days }, context),
      identifyResponseDelaysTool.execute({}, context)
    ]);
    if (!activity.ok || !missed.ok || !delays.ok) return fail("REPORT_FAILED", "Unable to compute full manager report.");

    const report = [
      activity.outputSummary,
      missed.outputSummary,
      delays.outputSummary,
      "Recommended next step: clear open follow-up queue and review missed-call recovery."
    ].join(" ");
    return ok("MANAGER_REPORT_GENERATED", { report, activity: activity.output, missed: missed.output, delays: delays.output }, "Manager report generated.");
  }
};

const checkAvailabilityTool: ToolDefinition<{ date?: string }> = {
  key: "check_availability",
  description: "Foundation scheduling check for appointment capacity.",
  inputSchema: z.object({ date: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["appointment", "lead"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const day = input.date ? new Date(input.date) : new Date();
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const count = await prisma.appointment.count({ where: { orgId: context.orgId, startAt: { gte: start, lt: end }, status: { not: AppointmentStatus.CANCELED } } });
    return ok("AVAILABILITY_CHECKED", { date: start.toISOString().slice(0, 10), bookedSlots: count, hasCapacity: count < 18 }, "Availability checked.");
  }
};

const suggestSlotsTool: ToolDefinition<{ date?: string }> = {
  key: "suggest_slots",
  description: "Foundation slot suggestions for scheduling agent.",
  inputSchema: z.object({ date: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["appointment", "lead"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input) {
    const base = input.date ? new Date(input.date) : new Date();
    base.setMinutes(0, 0, 0);
    const slots = [2, 4, 6].map((offset) => new Date(base.getTime() + offset * 60 * 60 * 1000).toISOString());
    return ok("SLOTS_SUGGESTED", { slots }, "Suggested 3 near-term slots.");
  }
};

const detectScheduleConflictTool: ToolDefinition<{ appointmentId?: string; startAt?: string; endAt?: string }> = {
  key: "detect_schedule_conflict",
  description: "Detect basic schedule overlap against existing appointments.",
  inputSchema: z.object({ appointmentId: z.string().optional(), startAt: z.string().optional(), endAt: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["appointment"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const startAt = input.startAt ? new Date(input.startAt) : null;
    const endAt = input.endAt ? new Date(input.endAt) : null;
    if (!startAt || !endAt) return fail("INVALID_TIME_RANGE");
    const conflicts = await prisma.appointment.count({
      where: {
        orgId: context.orgId,
        id: input.appointmentId ? { not: input.appointmentId } : undefined,
        status: { not: AppointmentStatus.CANCELED },
        startAt: { lt: endAt },
        endAt: { gt: startAt }
      }
    });
    return ok("SCHEDULE_CONFLICT_CHECKED", { conflicts, hasConflict: conflicts > 0 }, conflicts > 0 ? "Scheduling conflict detected." : "No conflict detected.");
  }
};

const suggestPipelineStageTool: ToolDefinition<{ leadId?: string }> = {
  key: "suggest_pipeline_stage",
  description: "Foundation CRM stage recommendation.",
  inputSchema: z.object({ leadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    const stage = lead.status === LeadStatus.WON ? "WON" : lead.status === LeadStatus.QUALIFIED ? "QUALIFIED" : "NEW";
    return ok("PIPELINE_STAGE_SUGGESTED", { leadId: lead.id, stage }, `Suggested stage: ${stage}.`);
  }
};

const detectStaleRecordTool: ToolDefinition<{ leadId?: string; days?: number }> = {
  key: "detect_stale_record",
  description: "Detect stale lead/pipeline records.",
  inputSchema: z.object({ leadId: z.string().optional(), days: z.number().int().min(1).max(120).optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    const days = Math.max(1, Math.min(120, Number(input.days || 14)));
    const stale = Date.now() - lead.updatedAt.getTime() > days * 24 * 60 * 60 * 1000;
    return ok("STALE_RECORD_CHECKED", { leadId: lead.id, stale, thresholdDays: days, updatedAt: toIso(lead.updatedAt) }, stale ? "Lead appears stale." : "Lead is active.");
  }
};

const recommendNextStepTool: ToolDefinition<{ leadId?: string }> = {
  key: "recommend_next_step",
  description: "Recommend next step for lead/pipeline.",
  inputSchema: z.object({ leadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead", "organization"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    const step =
      lead.status === LeadStatus.NEW
        ? "Send first-response outreach draft and schedule callback task."
        : lead.status === LeadStatus.CONTACTED
          ? "Confirm appointment window and move to qualification."
          : lead.status === LeadStatus.QUALIFIED
            ? "Push to booking and confirm appointment."
            : "No action needed.";
    return ok("NEXT_STEP_RECOMMENDED", { leadId: lead.id, step }, "Next-step recommendation generated.");
  }
};

const prioritizeJobsTool: ToolDefinition<Record<string, unknown>> = {
  key: "prioritize_jobs",
  description: "Foundation dispatch prioritization based on urgency and recency.",
  inputSchema: z.object({}).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization", "lead", "appointment"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(_, context) {
    const leads = await prisma.lead.findMany({ where: { orgId: context.orgId }, orderBy: { updatedAt: "desc" }, take: 20 });
    const prioritized = leads
      .map((lead) => ({
        leadId: lead.id,
        name: lead.name,
        priorityScore: scoreKeywordHits(`${lead.urgency || ""} ${lead.message || ""}`, ["urgent", "today", "emergency"]) + (lead.appointmentRequested ? 2 : 0)
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 8);
    return ok("JOBS_PRIORITIZED", { prioritized }, "Dispatch priority list generated.");
  }
};

const prepareDispatchNotesTool: ToolDefinition<{ leadId?: string }> = {
  key: "prepare_dispatch_notes",
  description: "Foundation dispatch notes based on lead details.",
  inputSchema: z.object({ leadId: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization", "lead", "appointment"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    const notes = [
      `Customer: ${lead.name}`,
      `Service requested: ${lead.serviceRequested || "Unknown"}`,
      `Address: ${lead.serviceAddress || "Not provided"}`,
      `Urgency: ${lead.urgency || "Normal"}`
    ];
    return ok("DISPATCH_NOTES_PREPARED", { leadId: lead.id, notes }, "Dispatch notes prepared.");
  }
};

const markLeadStatusTool: ToolDefinition<{ leadId?: string; status: "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST" }> = {
  key: "mark_lead_status",
  description: "Update lead status (approval-gated by policy).",
  inputSchema: z.object({ leadId: z.string().optional(), status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]) }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["lead"],
  approvalPolicy: "ALWAYS",
  idempotencyScope: "org_entity_tool",
  async execute(input, context) {
    const lead = await findLead(context.orgId, input.leadId || context.entityId);
    if (!lead) return fail("LEAD_NOT_FOUND");
    await prisma.lead.update({ where: { id: lead.id }, data: { status: input.status as LeadStatus } });
    return ok("LEAD_STATUS_UPDATED", { leadId: lead.id, status: input.status }, "Lead status updated.");
  }
};

const updateAppointmentStatusTool: ToolDefinition<{ appointmentId?: string; status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW" }> = {
  key: "update_appointment_status",
  description: "Update appointment status (approval-gated by policy).",
  inputSchema: z
    .object({ appointmentId: z.string().optional(), status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"]) })
    .passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["appointment"],
  approvalPolicy: "ALWAYS",
  idempotencyScope: "org_entity_tool",
  async execute(input, context) {
    const appointmentId = input.appointmentId || context.entityId;
    if (!appointmentId) return fail("APPOINTMENT_NOT_FOUND");
    const appt = await prisma.appointment.findFirst({ where: { id: appointmentId, orgId: context.orgId } });
    if (!appt) return fail("APPOINTMENT_NOT_FOUND");
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: input.status as AppointmentStatus } });
    return ok("APPOINTMENT_STATUS_UPDATED", { appointmentId: appt.id, status: input.status }, "Appointment status updated.");
  }
};

const genericDraftTool = (key: string, description: string): ToolDefinition<{ content?: string }> => ({
  key,
  description,
  inputSchema: z.object({ content: z.string().optional() }).passthrough(),
  requiredRoles: OPERATOR_ROLES,
  entityTypes: ["organization", "lead", "message_thread", "call", "appointment"],
  approvalPolicy: "NONE",
  idempotencyScope: "none",
  async execute(input) {
    return ok("DRAFT_READY", { draft: cleanText(input.content) || "Draft prepared. Review before send." }, "Draft prepared.");
  }
});

const toolDefinitions: Array<ToolDefinition<any>> = [
  summarizeCallTool,
  extractCallDetailsTool,
  classifyCallIntentTool,
  detectUrgencyTool,
  suggestFrontDeskActionTool,
  draftCallbackTool,
  createFollowupTaskTool,
  previewImportTool,
  importLeadsTool,
  dedupeLeadsTool,
  scoreLeadTool,
  summarizeLeadTool,
  draftOutreachEmailTool,
  draftOutreachSmsTool,
  classifyLeadReplyTool,
  generateCallPrepTool,
  scheduleLeadFollowupTool,
  summarizeThreadTool,
  classifyMessageTool,
  detectOptOutTool,
  draftReplyTool,
  routeThreadTool,
  markThreadStatusTool,
  createMessageFollowupTaskTool,
  createTaskTool,
  assignTaskTool,
  buildCallbackQueueTool,
  escalateOverdueItemTool,
  suggestDueDateTool,
  createReminderTool,
  scheduleFollowupTool,
  fetchBusinessContextTool,
  searchWorkspaceKnowledgeTool,
  answerInternalQuestionTool,
  summarizeWorkspaceActivityTool,
  computeMissedOpportunitiesTool,
  identifyResponseDelaysTool,
  generateManagerReportTool,
  checkAvailabilityTool,
  suggestSlotsTool,
  detectScheduleConflictTool,
  suggestPipelineStageTool,
  detectStaleRecordTool,
  recommendNextStepTool,
  prioritizeJobsTool,
  prepareDispatchNotesTool,
  markLeadStatusTool,
  updateAppointmentStatusTool,
  genericDraftTool("queue_email", "Queue email send request (approval gated)."),
  genericDraftTool("queue_sms", "Queue SMS send request (approval gated)."),
  genericDraftTool("send_approved_email", "Execute approved email send."),
  genericDraftTool("send_approved_sms", "Execute approved SMS send.")
];

const byKey = new Map(toolDefinitions.map((tool) => [tool.key, tool]));

export function getToolDefinition(toolKey: string) {
  return byKey.get(toolKey);
}

export function listToolDefinitions() {
  return toolDefinitions;
}
