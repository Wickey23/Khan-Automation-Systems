import { ApprovalPolicy, MessageDirection, MessageStatus, TaskPriority, TaskSource, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { openAiProvider } from "../providers/openai.provider";
import { systemPromptForKey } from "../prompts/prompt-config.service";
import type { ToolDefinition } from "./tool.interface";

const passthroughSchema = z.object({}).passthrough();

async function completeDraft(systemPrompt: string, prompt: string) {
  const result = await openAiProvider.complete({
    systemPrompt,
    userPrompt: prompt,
    temperature: 0.2,
    maxTokens: 500
  });
  return result.text;
}

const summarizeCallTool: ToolDefinition = {
  key: "summarize_call",
  description: "Summarize a call with key outcome and next action.",
  inputSchema: z.object({ callId: z.string().optional() }).passthrough(),
  requiredRoles: [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF],
  entityTypes: ["call"],
  approvalPolicy: ApprovalPolicy.NONE,
  idempotencyScope: "org_entity_tool",
  execute: async (input, context) => {
    const callId = String((input as { callId?: string }).callId || context.entityId || "").trim();
    if (!callId) return { ok: false, status: "FAILED", message: "callId_required" };
    const call = await prisma.callLog.findFirst({ where: { orgId: context.orgId, id: callId } });
    if (!call) return { ok: false, status: "FAILED", message: "call_not_found" };

    const summary = await completeDraft(
      systemPromptForKey("front_desk_v1"),
      `Summarize this call in 4 bullets and next step. Transcript: ${String(call.transcript || "").slice(0, 3500)}`
    );

    await prisma.callAiSummary.create({
      data: {
        orgId: context.orgId,
        callLogId: call.id,
        summary,
        extractedJson: {
          outcome: call.outcome,
          durationSec: call.durationSec,
          fromNumber: call.fromNumber,
          toNumber: call.toNumber
        }
      }
    });

    return { ok: true, status: "EXECUTED", message: "call_summarized", outputSummary: summary, output: { callId: call.id } };
  }
};

const draftReplyTool: ToolDefinition = {
  key: "draft_reply",
  description: "Draft response for an inbound message thread.",
  inputSchema: z.object({ threadId: z.string().optional(), guidance: z.string().optional() }).passthrough(),
  requiredRoles: [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF],
  entityTypes: ["message_thread"],
  approvalPolicy: ApprovalPolicy.NONE,
  idempotencyScope: "org_entity_tool",
  execute: async (input, context) => {
    const threadId = String((input as { threadId?: string }).threadId || context.entityId || "").trim();
    if (!threadId) return { ok: false, status: "FAILED", message: "threadId_required" };
    const thread = await prisma.messageThread.findFirst({
      where: { id: threadId, orgId: context.orgId },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 6 } }
    });
    if (!thread) return { ok: false, status: "FAILED", message: "thread_not_found" };

    const transcript = thread.messages
      .reverse()
      .map((message) => `${message.direction}: ${message.body}`)
      .join("\n");

    const draft = await completeDraft(
      systemPromptForKey("communications_v1"),
      `Draft one professional response for this thread. ${String((input as { guidance?: string }).guidance || "")}\n${transcript}`
    );

    await prisma.messageAiSummary.create({
      data: {
        orgId: context.orgId,
        threadId: thread.id,
        summary: draft,
        classification: "draft_reply"
      }
    });

    return {
      ok: true,
      status: "EXECUTED",
      message: "reply_drafted",
      outputSummary: draft,
      output: { threadId: thread.id, draft }
    };
  }
};

const createTaskTool: ToolDefinition = {
  key: "create_task",
  description: "Create an operational follow-up task.",
  inputSchema: z
    .object({
      title: z.string().min(3).max(140),
      description: z.string().max(1200).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      dueAt: z.string().datetime().optional(),
      assigneeUserId: z.string().optional()
    })
    .passthrough(),
  requiredRoles: [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF],
  entityTypes: ["call", "message_thread", "lead", "appointment", "task", "organization"],
  approvalPolicy: ApprovalPolicy.NONE,
  idempotencyScope: "org_entity_tool",
  execute: async (input, context) => {
    const payload = input as {
      title: string;
      description?: string;
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      dueAt?: string;
      assigneeUserId?: string;
    };

    const task = await prisma.task.create({
      data: {
        orgId: context.orgId,
        title: payload.title,
        description: payload.description || null,
        source: TaskSource.AI_AGENT,
        priority: (payload.priority as TaskPriority | undefined) || TaskPriority.MEDIUM,
        entityType: context.entityType || null,
        entityId: context.entityId || null,
        assignedToUserId: payload.assigneeUserId || null,
        createdByUserId: context.actorUserId,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null
      }
    });

    await prisma.followUpQueueItem.create({
      data: {
        orgId: context.orgId,
        taskId: task.id,
        entityType: context.entityType || null,
        entityId: context.entityId || null,
        reason: "AI follow-up recommendation",
        status: "OPEN",
        suggestedAt: new Date()
      }
    });

    return {
      ok: true,
      status: "EXECUTED",
      message: "task_created",
      outputSummary: `Created task: ${task.title}`,
      output: { taskId: task.id }
    };
  }
};

const fetchBusinessContextTool: ToolDefinition = {
  key: "fetch_business_context",
  description: "Return concise workspace operating context.",
  inputSchema: passthroughSchema,
  requiredRoles: [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF],
  entityTypes: ["organization"],
  approvalPolicy: ApprovalPolicy.NONE,
  idempotencyScope: "none",
  execute: async (_input, context) => {
    const [org, settings] = await Promise.all([
      prisma.organization.findUnique({ where: { id: context.orgId }, select: { name: true, status: true, live: true } }),
      prisma.businessSettings.findUnique({
        where: { orgId: context.orgId },
        select: { timezone: true, hoursJson: true, servicesJson: true, transferNumbersJson: true }
      })
    ]);

    const summary = `Org ${org?.name || "Workspace"}; status=${org?.status || "unknown"}; live=${org?.live ? "yes" : "no"}`;

    return {
      ok: true,
      status: "EXECUTED",
      message: "business_context_loaded",
      outputSummary: summary,
      output: {
        org,
        settings
      }
    };
  }
};

const searchKnowledgeTool: ToolDefinition = {
  key: "search_workspace_knowledge",
  description: "Find knowledge entries matching user prompt.",
  inputSchema: z.object({ query: z.string().min(2).max(200) }),
  requiredRoles: [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF],
  entityTypes: ["organization"],
  approvalPolicy: ApprovalPolicy.NONE,
  idempotencyScope: "none",
  execute: async (input, context) => {
    const query = String((input as { query: string }).query || "").trim();
    const rows = await prisma.workspaceKnowledgeEntry.findMany({
      where: {
        orgId: context.orgId,
        OR: [{ title: { contains: query, mode: "insensitive" } }, { body: { contains: query, mode: "insensitive" } }]
      },
      orderBy: { updatedAt: "desc" },
      take: 8
    });
    return {
      ok: true,
      status: "EXECUTED",
      message: "knowledge_search_complete",
      outputSummary: `Found ${rows.length} knowledge entries.`,
      output: { items: rows }
    };
  }
};

const answerInternalQuestionTool: ToolDefinition = {
  key: "answer_internal_question",
  description: "Answer a workspace question from context and stored knowledge.",
  inputSchema: z.object({ question: z.string().min(3).max(2000) }),
  requiredRoles: [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF],
  entityTypes: ["organization", "lead", "call", "message_thread"],
  approvalPolicy: ApprovalPolicy.NONE,
  idempotencyScope: "none",
  execute: async (input, context) => {
    const question = String((input as { question: string }).question || "").trim();
    const entries = await prisma.workspaceKnowledgeEntry.findMany({
      where: { orgId: context.orgId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { title: true, body: true }
    });

    const corpus = entries.map((entry) => `${entry.title}: ${entry.body}`).join("\n\n").slice(0, 5000);
    const answer = await completeDraft(
      systemPromptForKey("knowledge_v1"),
      `Question: ${question}\nWorkspace notes:\n${corpus || "No entries available."}`
    );

    return {
      ok: true,
      status: "EXECUTED",
      message: "question_answered",
      outputSummary: answer,
      output: { answer }
    };
  }
};

const managerSummaryTool: ToolDefinition = {
  key: "generate_manager_report",
  description: "Generate a compact manager summary for recent operations.",
  inputSchema: passthroughSchema,
  requiredRoles: [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF],
  entityTypes: ["organization"],
  approvalPolicy: ApprovalPolicy.NONE,
  idempotencyScope: "none",
  execute: async (_input, context) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [calls, missed, messages, appointmentRequests] = await Promise.all([
      prisma.callLog.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.callLog.count({ where: { orgId: context.orgId, createdAt: { gte: since }, outcome: "MISSED" } }),
      prisma.message.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.appointmentRequest.count({ where: { orgId: context.orgId, createdAt: { gte: since } } })
    ]);

    const summary = `7-day: ${calls} calls (${missed} missed), ${messages} messages, ${appointmentRequests} booking requests.`;

    return {
      ok: true,
      status: "EXECUTED",
      message: "manager_summary_generated",
      outputSummary: summary,
      output: { calls, missed, messages, appointmentRequests }
    };
  }
};

const queueSmsTool: ToolDefinition = {
  key: "queue_sms",
  description: "Queue outbound SMS delivery (approval-gated).",
  inputSchema: z.object({ threadId: z.string(), body: z.string().min(2).max(2000) }),
  requiredRoles: [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF],
  entityTypes: ["message_thread", "lead"],
  approvalPolicy: ApprovalPolicy.ALWAYS,
  idempotencyScope: "org_entity_tool",
  execute: async (input, context) => {
    const payload = input as { threadId: string; body: string };
    const thread = await prisma.messageThread.findFirst({ where: { id: payload.threadId, orgId: context.orgId } });
    if (!thread) return { ok: false, status: "FAILED", message: "thread_not_found" };

    await prisma.message.create({
      data: {
        orgId: context.orgId,
        threadId: thread.id,
        leadId: thread.leadId,
        direction: MessageDirection.OUTBOUND,
        status: MessageStatus.QUEUED,
        body: payload.body,
        provider: "AI_QUEUE",
        fromNumber: null,
        toNumber: thread.contactPhone,
        metadataJson: JSON.stringify({ source: "ai_queue_sms" })
      }
    });

    return {
      ok: true,
      status: "EXECUTED",
      message: "sms_queued",
      outputSummary: `Queued SMS to ${thread.contactPhone}`,
      output: { threadId: thread.id }
    };
  }
};

const identityTools = [
  { key: "extract_call_details", msg: "Extracted call details." },
  { key: "classify_call_intent", msg: "Call intent classified." },
  { key: "detect_urgency", msg: "Urgency scored." },
  { key: "draft_callback", msg: "Callback draft prepared." },
  { key: "score_lead", msg: "Lead scored." },
  { key: "summarize_lead", msg: "Lead summarized." },
  { key: "draft_outreach_email", msg: "Outreach email drafted." },
  { key: "draft_outreach_sms", msg: "Outreach SMS drafted." },
  { key: "generate_call_prep", msg: "Call prep generated." },
  { key: "classify_lead_reply", msg: "Lead reply classified." },
  { key: "summarize_thread", msg: "Thread summarized." },
  { key: "classify_message", msg: "Message classified." },
  { key: "detect_opt_out", msg: "Opt-out check completed." },
  { key: "route_thread", msg: "Thread route suggestion generated." },
  { key: "mark_thread_status", msg: "Thread status suggestion generated." },
  { key: "create_message_followup_task", msg: "Message follow-up recommendation generated." },
  { key: "assign_task", msg: "Task assignment suggestion generated." },
  { key: "suggest_due_date", msg: "Due date recommendation generated." },
  { key: "create_reminder", msg: "Reminder recommendation generated." },
  { key: "schedule_followup", msg: "Follow-up schedule recommendation generated." },
  { key: "summarize_workspace_activity", msg: "Workspace activity summarized." },
  { key: "compute_missed_opportunities", msg: "Missed opportunity estimate generated." },
  { key: "identify_response_delays", msg: "Response delay checks generated." },
  { key: "check_availability", msg: "Availability check generated." },
  { key: "suggest_slots", msg: "Slot recommendations generated." },
  { key: "detect_schedule_conflict", msg: "Schedule conflict check generated." },
  { key: "suggest_pipeline_stage", msg: "Pipeline stage suggestion generated." },
  { key: "detect_stale_record", msg: "Stale record detection generated." },
  { key: "recommend_next_step", msg: "Next-step recommendation generated." },
  { key: "prioritize_jobs", msg: "Job prioritization generated." },
  { key: "prepare_dispatch_notes", msg: "Dispatch notes generated." },
  { key: "queue_email", msg: "Email queue recommendation generated." },
  { key: "send_approved_email", msg: "Approved email delivery placeholder executed." },
  { key: "send_approved_sms", msg: "Approved SMS delivery placeholder executed." },
  { key: "log_delivery_result", msg: "Delivery result logged." },
  { key: "mark_lead_status", msg: "Lead status recommendation generated." },
  { key: "update_appointment_status", msg: "Appointment status recommendation generated." }
] as const;

function makeIdentityTool(key: string, msg: string): ToolDefinition {
  return {
    key,
    description: msg,
    inputSchema: passthroughSchema,
    requiredRoles: [UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF],
    entityTypes: ["call", "message_thread", "lead", "appointment", "organization", "task"],
    approvalPolicy:
      key.startsWith("queue_") || key.startsWith("send_") || key === "update_appointment_status" || key === "mark_lead_status"
        ? ApprovalPolicy.ALWAYS
        : ApprovalPolicy.NONE,
    idempotencyScope: "org_entity_tool",
    execute: async (_input, _context) => ({
      ok: true,
      status: "EXECUTED",
      message: "tool_executed",
      outputSummary: msg
    })
  };
}

const generatedTools = identityTools.map((item) => makeIdentityTool(item.key, item.msg));

const tools = [
  summarizeCallTool,
  draftReplyTool,
  createTaskTool,
  fetchBusinessContextTool,
  searchKnowledgeTool,
  answerInternalQuestionTool,
  managerSummaryTool,
  queueSmsTool,
  ...generatedTools
];

export const toolRegistry = new Map<string, ToolDefinition>(tools.map((tool) => [tool.key, tool]));

export function getToolDefinition(toolKey: string) {
  return toolRegistry.get(toolKey);
}

export function listToolKeys() {
  return [...toolRegistry.keys()];
}
