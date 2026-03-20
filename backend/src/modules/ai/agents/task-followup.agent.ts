import type { AgentPlanner } from "./agent.interface";

export const taskFollowupAgent: AgentPlanner = {
  key: "task_followup",
  plan: (input) => {
    return [
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
  }
};
