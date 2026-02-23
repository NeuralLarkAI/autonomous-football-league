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
