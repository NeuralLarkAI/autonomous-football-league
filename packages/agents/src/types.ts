export interface AgentRunner {
  agentId: string;
  run(): Promise<void>;
}
