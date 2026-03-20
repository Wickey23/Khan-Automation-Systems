import type { AgentPlanner } from "./agent.interface";

export const knowledgeAgent: AgentPlanner = {
  key: "knowledge",
  plan: (input) => {
    return [
      { toolKey: "search_workspace_knowledge", input: { query: input.prompt }, reason: "Find matching knowledge entries" },
      { toolKey: "answer_internal_question", input: { question: input.prompt }, reason: "Provide workspace-scoped answer" }
    ];
  }
};
