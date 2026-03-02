import { Router } from "express";
import { prisma } from "../../lib/prisma";

export const publicRouter = Router();

function parseQuestions(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((item) => String(item || "").trim())
      .filter((item) => item.length > 0)
      .slice(0, 12);
  } catch {
    return [] as string[];
  }
}

publicRouter.get("/demo-config", async (_req, res) => {
  const config = await prisma.appConfig.findUnique({ where: { id: "singleton" } });
  return res.json({
    ok: true,
    data: {
      demoNumber: config?.demoNumber || null,
      demoTitle: config?.demoTitle || null,
      demoSubtitle: config?.demoSubtitle || null,
      demoQuestions: parseQuestions(config?.demoQuestionsJson)
    }
  });
});

