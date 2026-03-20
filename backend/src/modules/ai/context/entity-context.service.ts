import { prisma } from "../../../lib/prisma";

export type EntityContext = {
  entityType: string;
  entityId: string;
  summary: string;
  payload: Record<string, unknown>;
};

export async function buildEntityContext(input: {
  orgId: string;
  entityType?: string;
  entityId?: string;
}): Promise<EntityContext | null> {
  const entityType = String(input.entityType || "").trim();
  const entityId = String(input.entityId || "").trim();
  if (!entityType || !entityId) return null;

  if (entityType === "call") {
    const call = await prisma.callLog.findFirst({
      where: { orgId: input.orgId, id: entityId },
      select: {
        id: true,
        fromNumber: true,
        toNumber: true,
        aiSummary: true,
        transcript: true,
        outcome: true,
        startedAt: true,
        durationSec: true
      }
    });
    if (!call) return null;
    return {
      entityType,
      entityId,
      summary: `Call ${call.id} from ${call.fromNumber}. Outcome: ${call.outcome}.`,
      payload: {
        ...call,
        transcript: String(call.transcript || "").slice(0, 4000)
      }
    };
  }

  if (entityType === "message_thread") {
    const thread = await prisma.messageThread.findFirst({
      where: { orgId: input.orgId, id: entityId },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 12 } }
    });
    if (!thread) return null;
    return {
      entityType,
      entityId,
      summary: `Thread with ${thread.contactPhone} (${thread.channel}).`,
      payload: {
        id: thread.id,
        contactName: thread.contactName,
        contactPhone: thread.contactPhone,
        messages: thread.messages
      }
    };
  }

  if (entityType === "lead") {
    const lead = await prisma.lead.findFirst({
      where: { orgId: input.orgId, id: entityId },
      select: {
        id: true,
        name: true,
        business: true,
        email: true,
        phone: true,
        message: true,
        pipelineStage: true,
        urgency: true,
        notes: true,
        createdAt: true
      }
    });
    if (!lead) return null;
    return {
      entityType,
      entityId,
      summary: `Lead ${lead.name || lead.phone || lead.id} in stage ${lead.pipelineStage}.`,
      payload: lead
    };
  }

  if (entityType === "appointment") {
    const appointment = await prisma.appointment.findFirst({
      where: { orgId: input.orgId, id: entityId },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        issueSummary: true,
        status: true,
        startAt: true,
        endAt: true,
        assignedTechnician: true
      }
    });
    if (!appointment) return null;
    return {
      entityType,
      entityId,
      summary: `Appointment ${appointment.id} for ${appointment.customerName || appointment.customerPhone}.`,
      payload: appointment
    };
  }

  return null;
}
