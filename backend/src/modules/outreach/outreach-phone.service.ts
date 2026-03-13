import type { PrismaClient, UserRole } from "@prisma/client";
import { env } from "../../config/env";

function normalizePhoneE164(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const digits = `+${raw.slice(1).replace(/\D/g, "")}`;
    return /^\+\d{10,15}$/.test(digits) ? digits : "";
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return /^\d{10,15}$/.test(digits) ? `+${digits}` : "";
}

function cleanText(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text || "";
}

function buildOutreachPhonePrompt(input: {
  orgName: string;
  companyName: string;
  contactName: string;
  industry: string;
  city: string;
  state: string;
  notes: string;
}) {
  return [
    "You are an AI sales assistant making a short professional outreach call for Khan Automation Systems.",
    `Organization: ${input.orgName}`,
    `Prospect company: ${input.companyName || "Unknown company"}`,
    `Prospect contact: ${input.contactName || "Unknown contact"}`,
    `Industry: ${input.industry || "Local service business"}`,
    `Location: ${[input.city, input.state].filter(Boolean).join(", ") || "Unknown"}`,
    `Lead notes: ${input.notes || "None"}`,
    "Your goal is to briefly introduce Khan Automation Systems and ask whether the business would be open to learning how AI phone answering and missed-call recovery could help them capture more jobs.",
    "Call style rules:",
    "- Sound professional, calm, concise, and respectful.",
    "- Do not sound like a chatbot or over-explain.",
    "- Ask at most one question at a time.",
    "- Keep the call under 90 seconds unless the prospect actively engages.",
    "- If the person is not interested, thank them politely and end the call cleanly.",
    "- If the person asks for details, explain simply that the system answers calls, captures service requests, recovers missed calls with text, and gives the office a clear action queue.",
    "- If the person shows interest, ask for the best next step: quick callback, demo, or permission to text/email details.",
    "- If they ask to speak to a human, say a team member will follow up directly.",
    "- Never pressure the caller. Never argue. Never pretend there is a booking or dispatch action.",
    "- Never invent pricing, promises, or implementation details you do not know.",
    "- If the line is unclear or you cannot understand them, apologize once, ask for a brief repeat, and if still unclear, say a team member can follow up later.",
    "Safe close examples:",
    "- Thanks for your time. We will not keep you.",
    "- Appreciate it. A team member can follow up with more details.",
    "- Understood. Thanks for taking the call.",
    "Primary objective: determine interest level and leave a professional impression."
  ].join("\n");
}

export async function startOutreachAiCall(input: {
  prisma: PrismaClient;
  leadId: string;
  actorUserId: string;
  actorRole: UserRole;
}) {
  const db = input.prisma as any;
  const lead = await db.outreachLead.findUnique({
    where: { id: input.leadId },
    include: {
      organization: { select: { id: true, name: true } }
    }
  });
  if (!lead) {
    throw new Error("Lead not found.");
  }

  const customerNumber = normalizePhoneE164(lead.phone || "");
  if (!customerNumber) {
    throw new Error("Lead does not have a valid phone number for AI calling.");
  }
  if (!env.VAPI_API_KEY) {
    throw new Error("VAPI_API_KEY is not configured.");
  }

  const aiConfig = await db.aiAgentConfig.findFirst({
    where: { orgId: lead.orgId },
    select: {
      model: true,
      voice: true,
      temperature: true,
      vapiPhoneNumberId: true
    }
  });
  const appConfig = await db.appConfig.findUnique({
    where: { id: "singleton" },
    select: {
      demoVapiPhoneNumberId: true
    }
  });

  const phoneNumberId = cleanText(aiConfig?.vapiPhoneNumberId) || cleanText(appConfig?.demoVapiPhoneNumberId);
  if (!phoneNumberId) {
    throw new Error("No Vapi outbound phone number is configured for outreach calling.");
  }

  const response = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.VAPI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      phoneNumberId,
      customer: {
        number: customerNumber,
        name: cleanText(lead.contactName) || cleanText(lead.companyName) || undefined
      },
      assistant: {
        name: `Khan Outreach - ${cleanText(lead.companyName) || cleanText(lead.contactName) || "Prospect"}`,
        model: cleanText(aiConfig?.model) || "gpt-4o-mini",
        voice: cleanText(aiConfig?.voice) || "alloy",
        temperature: typeof aiConfig?.temperature === "number" ? aiConfig.temperature : 0.3,
        systemPrompt: buildOutreachPhonePrompt({
          orgName: cleanText(lead.organization?.name) || "Khan Automation Systems",
          companyName: cleanText(lead.companyName),
          contactName: cleanText(lead.contactName),
          industry: cleanText(lead.industry),
          city: cleanText(lead.city),
          state: cleanText(lead.state),
          notes: cleanText(lead.notes)
        })
      },
      metadata: {
        source: "admin-outreach",
        outreachLeadId: lead.id,
        orgId: lead.orgId,
        companyName: cleanText(lead.companyName) || null,
        contactName: cleanText(lead.contactName) || null
      }
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Vapi call request failed (${response.status}): ${text || "Unknown error"}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const callId = String(payload.id || payload.callId || "").trim();
  const status = String(payload.status || "queued").trim() || "queued";

  await Promise.all([
    db.outreachLead.update({
      where: { id: lead.id },
      data: {
        lastContactedAt: new Date(),
        status: lead.status === "NEW" ? "ACTIVE" : undefined
      }
    }),
    db.auditLog.create({
      data: {
        orgId: lead.orgId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: "OUTREACH_AI_CALL_STARTED",
        metadataJson: JSON.stringify({
          leadId: lead.id,
          callId: callId || null,
          status,
          toNumber: customerNumber,
          phoneNumberId
        })
      }
    })
  ]);

  return {
    leadId: lead.id,
    callId: callId || null,
    status,
    toNumber: customerNumber,
    phoneNumberId
  };
}
