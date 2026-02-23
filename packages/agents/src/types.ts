export interface AgentRunner {
  agentId: string;
  run(): Promise<AgentRunResult>;
}

export interface AgentRunResult {
  tasksCreated: number;
  approvalsCreated: number;
  eventsCreated: number;
  summary: string;
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
