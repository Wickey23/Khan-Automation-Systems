import type { PrismaClient } from "@prisma/client";

type ScenarioSeed = {
  name: string;
  script: string;
  expectedOutcome: string;
  tags: string[];
};

const DEFAULT_SCENARIOS: ScenarioSeed[] = [
  {
    name: "Standard service intake",
    script: "Caller requests a routine service appointment and provides all details.",
    expectedOutcome: "MESSAGE_TAKEN",
    tags: ["intake", "standard"]
  },
  {
    name: "Emergency transfer",
    script: "Caller reports urgent failure and requests immediate human support.",
    expectedOutcome: "TRANSFERRED",
    tags: ["urgent", "transfer"]
  },
  {
    name: "After-hours non-urgent",
    script: "Caller reaches out after-hours for non-emergency issue.",
    expectedOutcome: "MESSAGE_TAKEN",
    tags: ["after_hours"]
  },
  {
    name: "After-hours emergency",
    script: "Caller reports after-hours emergency requiring escalation.",
    expectedOutcome: "TRANSFERRED",
    tags: ["after_hours", "urgent", "transfer"]
  },
  {
    name: "Appointment request",
    script: "Caller asks to schedule installation with preferred date.",
    expectedOutcome: "APPOINTMENT_REQUEST",
    tags: ["appointment"]
  },
  {
    name: "Wrong number handling",
    script: "Caller reached wrong business and needs redirection.",
    expectedOutcome: "MESSAGE_TAKEN",
    tags: ["fallback"]
  },
  {
    name: "Language handling",
    script: "Caller asks for alternate language support.",
    expectedOutcome: "MESSAGE_TAKEN",
    tags: ["language"]
  },
  {
    name: "Incomplete caller info",
    script: "Caller refuses to share full details; system should still capture minimal lead.",
    expectedOutcome: "MESSAGE_TAKEN",
    tags: ["intake", "compliance"]
  }
];

export async function ensureDefaultTestScenarios(prisma: PrismaClient, orgId: string) {
  const count = await prisma.testScenario.count({ where: { orgId } });
  if (count > 0) return;
  await prisma.testScenario.createMany({
    data: DEFAULT_SCENARIOS.map((scenario) => ({
      orgId,
      name: scenario.name,
      script: scenario.script,
      expectedOutcome: scenario.expectedOutcome,
      tagsJson: JSON.stringify(scenario.tags)
    }))
  });
}

export async function getTestPassSummary(prisma: PrismaClient, orgId: string) {
  const scenarios = await prisma.testScenario.findMany({
    where: { orgId },
    include: {
      testRuns: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  const latestByScenario = scenarios.map((scenario) => ({
    scenarioId: scenario.id,
    tags: (() => {
      try {
        const parsed = JSON.parse(scenario.tagsJson) as unknown;
        return Array.isArray(parsed) ? parsed.map((tag) => String(tag)) : [];
      } catch {
        return [];
      }
    })(),
    latestRun: scenario.testRuns[0] || null
  }));

  const passed = latestByScenario.filter((item) => item.latestRun?.status === "PASS");
  const hasAfterHoursPass = passed.some((item) => item.tags.includes("after_hours"));
  const hasTransferPass = passed.some((item) => item.tags.includes("transfer"));

  return {
    scenarios,
    totalPassed: passed.length,
    hasAfterHoursPass,
    hasTransferPass
  };
}

