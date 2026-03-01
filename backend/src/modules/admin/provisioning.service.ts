import type { PrismaClient, UserRole } from "@prisma/client";

export type ChecklistStepStatus = "TODO" | "DONE" | "BLOCKED";
export type ChecklistStep = {
  key: string;
  label: string;
  status: ChecklistStepStatus;
  completedAt: string | null;
  completedByUserId: string | null;
  notes: string;
};

const DEFAULT_STEPS: ChecklistStep[] = [
  { key: "paid", label: "Paid", status: "TODO", completedAt: null, completedByUserId: null, notes: "" },
  {
    key: "onboarding_approved",
    label: "Onboarding Approved",
    status: "TODO",
    completedAt: null,
    completedByUserId: null,
    notes: ""
  },
  {
    key: "business_settings_confirmed",
    label: "Business Settings Confirmed",
    status: "TODO",
    completedAt: null,
    completedByUserId: null,
    notes: ""
  },
  {
    key: "twilio_number_assigned",
    label: "Twilio Number Assigned",
    status: "TODO",
    completedAt: null,
    completedByUserId: null,
    notes: ""
  },
  {
    key: "webhooks_verified",
    label: "Webhooks Verified",
    status: "TODO",
    completedAt: null,
    completedByUserId: null,
    notes: ""
  },
  {
    key: "vapi_agent_configured",
    label: "Vapi Agent Configured",
    status: "TODO",
    completedAt: null,
    completedByUserId: null,
    notes: ""
  },
  {
    key: "test_calls_completed",
    label: "Test Calls Completed",
    status: "TODO",
    completedAt: null,
    completedByUserId: null,
    notes: ""
  },
  {
    key: "notifications_verified",
    label: "Notifications Verified",
    status: "TODO",
    completedAt: null,
    completedByUserId: null,
    notes: ""
  },
  { key: "go_live", label: "Go Live", status: "TODO", completedAt: null, completedByUserId: null, notes: "" }
];

function parseSteps(raw: string | null | undefined): ChecklistStep[] {
  if (!raw) return DEFAULT_STEPS;
  try {
    const parsed = JSON.parse(raw) as ChecklistStep[];
    if (!Array.isArray(parsed)) return DEFAULT_STEPS;
    return DEFAULT_STEPS.map((step) => parsed.find((p) => p.key === step.key) || step);
  } catch {
    return DEFAULT_STEPS;
  }
}

export async function upsertChecklistStep(input: {
  prisma: PrismaClient;
  orgId: string;
  key: string;
  status: ChecklistStepStatus;
  userId: string;
  notes?: string;
}) {
  const checklist = await input.prisma.provisioningChecklist.findUnique({ where: { orgId: input.orgId } });
  const steps = parseSteps(checklist?.stepsJson);
  const nextSteps = steps.map((step) =>
    step.key !== input.key
      ? step
      : {
          ...step,
          status: input.status,
          completedAt: input.status === "DONE" ? new Date().toISOString() : null,
          completedByUserId: input.status === "DONE" ? input.userId : null,
          notes: input.notes ?? step.notes
        }
  );

  return input.prisma.provisioningChecklist.upsert({
    where: { orgId: input.orgId },
    update: { stepsJson: JSON.stringify(nextSteps) },
    create: { orgId: input.orgId, stepsJson: JSON.stringify(nextSteps) }
  });
}

export async function writeAuditLog(input: {
  prisma: PrismaClient;
  orgId?: string;
  actorUserId: string;
  actorRole: UserRole | string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  return input.prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorRole: String(input.actorRole),
      action: input.action,
      metadataJson: JSON.stringify(input.metadata || {})
    }
  });
}

export function getDefaultChecklistSteps() {
  return DEFAULT_STEPS;
}
