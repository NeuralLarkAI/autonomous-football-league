export interface AgentRunner {
  agentId: string;
  run(): Promise<AgentRunResult>;
}

export interface AgentDeliverableTargets {
  tasks: number;
  proposals: number;
  incidents: number;
  combineRuns: number;
  socialPosts: number;
  runbooks: number;
  moderationActions: number;
  signoffRequests: number;
}

export interface AgentSeasonDeliverables {
  agentId: string;
  title: string;
  summary: string;
  deliverables: string[];
  targets: AgentDeliverableTargets;
}

export interface AgentRunOutputRefs {
  taskIds: string[];
  approvalIds: string[];
  proposalIds: string[];
  incidentIds: string[];
  combineRunIds: string[];
  postIds: string[];
  runbookIds: string[];
  signoffIds: string[];
  moderationActionIds: string[];
  eventLogIds: string[];
}

export interface AgentRunObservedCounts {
  tasksCreated: number;
  approvalsCreated: number;
  proposalsCreated: number;
  incidentsCreated: number;
  combineRunsCreated: number;
  socialPostsCreated: number;
  runbooksCreated: number;
  signoffRequestsCreated: number;
  moderationActionsCreated: number;
  eventsCreated: number;
}

export interface AgentRunResult {
  tasksCreated: number;
  approvalsCreated: number;
  eventsCreated: number;
  summary: string;
  outputs: AgentRunOutputRefs;
  observed: AgentRunObservedCounts;
  deliverablesPlan?: AgentSeasonDeliverables;
}

export interface CombineScenarioResult {
  scenarioKey: string;
  passed: boolean;
  latencyMs: number;
  outputJson: string;
  score: number;
  errorText: string;
}

export interface CombineRunResult {
  combineRunId: string;
  status: "COMPLETED" | "FAILED";
  scoreOverall: number;
  scoreLatency: number;
  scoreReliability: number;
  durationMs: number;
  results: CombineScenarioResult[];
}
