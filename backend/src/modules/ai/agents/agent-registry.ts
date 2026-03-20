import type { AgentPlanner } from "./agent.interface";
import { communicationsAgent } from "./communications.agent";
import { crmPipelineAgent } from "./crm-pipeline.agent";
import { dispatchOpsAgent } from "./dispatch-ops.agent";
import { frontDeskAgent } from "./front-desk.agent";
import { knowledgeAgent } from "./knowledge.agent";
import { leadOpsAgent } from "./lead-ops.agent";
import { managerAnalyticsAgent } from "./manager-analytics.agent";
import { schedulingAgent } from "./scheduling.agent";
import { taskFollowupAgent } from "./task-followup.agent";

const planners = new Map<string, AgentPlanner>([
  [frontDeskAgent.key, frontDeskAgent],
  [leadOpsAgent.key, leadOpsAgent],
  [communicationsAgent.key, communicationsAgent],
  [schedulingAgent.key, schedulingAgent],
  [crmPipelineAgent.key, crmPipelineAgent],
  [taskFollowupAgent.key, taskFollowupAgent],
  [knowledgeAgent.key, knowledgeAgent],
  [managerAnalyticsAgent.key, managerAnalyticsAgent],
  [dispatchOpsAgent.key, dispatchOpsAgent]
]);

export function getAgentPlanner(agentKey: string) {
  return planners.get(agentKey);
}
