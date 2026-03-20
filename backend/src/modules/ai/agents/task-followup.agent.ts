import type { AgentPlanner } from "./agent.interface";

export const taskFollowupAgent: AgentPlanner = {
  key: "task_followup",
  plan: (input) => {
    const prompt = input.prompt.toLowerCase();
    const planned: Array<{ toolKey: string; input: Record<string, unknown>; reason: string }> = [
      {
        toolKey: "create_task",
        input: {
          title: `Follow up: ${input.prompt.slice(0, 80)}`,
          description: input.prompt
        },
        reason: "Convert prompt into actionable follow-up"
      },
      {
        toolKey: "suggest_due_date",
        input: {},
        reason: "Attach due-date guidance"
      }
    ];
    if (prompt.includes("callback")) {
      planned.push({ toolKey: "build_callback_queue", input: {}, reason: "Build callback queue for missed calls" });
    }
    if (prompt.includes("overdue") || prompt.includes("escalate")) {
      planned.push({ toolKey: "escalate_overdue_item", input: { taskId: input.entityId }, reason: "Escalate overdue item" });
    }
    return planned;
  }
};
