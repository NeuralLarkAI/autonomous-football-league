type AgentNarrativeInput = {
  agentName: string;
  goal: string;
  context: string;
};

export type ChiefOfStaffTaskIdea = {
  title: string;
  description: string;
  department: string;
  tier: number;
  acceptanceCriteria: string;
  riskNotes: string;
  testPlan: string;
  rollbackPlan: string;
};

export type CommissionerRecommendedAction = {
  action: "APPROVE_APPROVAL" | "FLAG_INCIDENT" | "TRIGGER_RUNBOOK" | "CREATE_NOTICE";
  targetId?: string;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

export type CommissionerDecision = {
  narrative: string;
  recommendedActions: CommissionerRecommendedAction[];
  leagueHealthScore: number;
  summary: string;
};

type CommissionerDecisionInput = {
  season: number;
  openTasks: number;
  pendingApprovals: number;
  openIncidents: number;
  scheduledRunbooks: number;
  pendingProposals: Array<{ id: string; title: string; tier: number; summary: string }>;
  recentIncidents: Array<{ id: string; title: string; severity: string }>;
  pendingApprovalItems: Array<{ id: string; summary: string; tier: number }>;
};

function getClaudeConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? "";
  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
  return { apiKey, model };
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL_CHIEF_OF_STAFF ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  return { apiKey, model };
}

export function hasClaudeAgentBrain(): boolean {
  return Boolean(getClaudeConfig().apiKey);
}

export function hasOpenAIAgentBrain(): boolean {
  return Boolean(getOpenAIConfig().apiKey);
}

async function callClaude(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
  temperature: number,
  timeoutMs = 20_000
): Promise<string | null> {
  const { apiKey, model } = getClaudeConfig();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: [{ type: "text", text: userContent }] }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[agents][claude] request failed ${response.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = data.content?.find((c) => c?.type === "text")?.text?.trim();
    return text || null;
  } catch (error) {
    console.error("[agents][claude] request error", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
  temperature: number,
  timeoutMs = 20_000
): Promise<string | null> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[agents][openai] request failed ${response.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (error) {
    console.error("[agents][openai] request error", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAgentNarrative(input: AgentNarrativeInput): Promise<string | null> {
  return callClaude(
    "You are an operations-focused sports league commissioner agent. Be concise, concrete, and action-oriented. Do not reveal secrets.",
    `Agent: ${input.agentName}\nGoal: ${input.goal}\nContext:\n${input.context}\n\nProduce markdown with clear bullets.`,
    500,
    0.2
  );
}

export async function generateCommissionerDecision(
  input: CommissionerDecisionInput
): Promise<CommissionerDecision | null> {
  const { apiKey } = getClaudeConfig();
  if (!apiKey) return null;

  const proposalLines = input.pendingProposals.length
    ? input.pendingProposals.map((p) => `  - [Tier ${p.tier}] ${p.title}: ${p.summary}`).join("\n")
    : "  None";

  const incidentLines = input.recentIncidents.length
    ? input.recentIncidents.map((i) => `  - [${i.severity}] ${i.title}`).join("\n")
    : "  None";

  const approvalLines = input.pendingApprovalItems.length
    ? input.pendingApprovalItems.map((a) => `  - [id:${a.id}|Tier ${a.tier}] ${a.summary}`).join("\n")
    : "  None";

  const userContent = `You are the autonomous League Commissioner for AFL Prime. Analyze the current league state and produce a structured JSON decision.

Current League State:
- Season: ${input.season}
- Open tasks: ${input.openTasks}
- Pending approvals: ${input.pendingApprovals}
- Open incidents: ${input.openIncidents}
- Enabled scheduled runbooks: ${input.scheduledRunbooks}

Pending Proposals:
${proposalLines}

Recent Open Incidents:
${incidentLines}

Pending Approval Items:
${approvalLines}

Respond with ONLY valid JSON matching this exact structure:
{
  "narrative": "2-3 sentence operational status in markdown",
  "leagueHealthScore": <integer 0-100>,
  "summary": "one sentence tl;dr",
  "recommendedActions": [
    {
      "action": "APPROVE_APPROVAL" | "FLAG_INCIDENT" | "TRIGGER_RUNBOOK" | "CREATE_NOTICE",
      "targetId": "<id string or null>",
      "reason": "why this action",
      "priority": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}

Rules for recommendedActions:
- Only recommend APPROVE_APPROVAL for Tier 0 or Tier 1 items (low governance risk).
- Recommend FLAG_INCIDENT if open incidents > 3 or any CRITICAL severity incident exists.
- Recommend TRIGGER_RUNBOOK only if a specific operational gap is detected.
- Always include at least one CREATE_NOTICE action with the operational narrative.
- Keep the array to 5 or fewer actions.`;

  const raw = await callClaude(
    "You are an autonomous league commissioner AI. Respond only with valid JSON, no prose, no markdown fences.",
    userContent,
    800,
    0.1,
    25_000
  );

  if (!raw) return null;

  try {
    // Strip markdown fences if Claude wraps anyway
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned) as CommissionerDecision;
    // Basic validation
    if (typeof parsed.narrative !== "string" || !Array.isArray(parsed.recommendedActions)) {
      console.error("[agents][claude] commissioner decision parse: unexpected shape");
      return null;
    }
    return parsed;
  } catch (err) {
    console.error("[agents][claude] commissioner decision JSON parse failed:", err);
    return null;
  }
}

export async function generateChiefOfStaffTaskIdeas(input: {
  season: number;
  openTasks: number;
  pendingApprovals: number;
  openIncidents: number;
  desiredCount: number;
}): Promise<ChiefOfStaffTaskIdea[] | null> {
  const raw = await callOpenAI(
    "You are Chief of Staff for an autonomous football league operations team. Output only strict JSON with practical operational tasks.",
    `Generate ${input.desiredCount} new backlog tasks.

Current state:
- season: ${input.season}
- openTasks: ${input.openTasks}
- pendingApprovals: ${input.pendingApprovals}
- openIncidents: ${input.openIncidents}

Return ONLY JSON array where each item is:
{
  "title": string,
  "description": string,
  "department": "COMMISSIONER" | "TECHNOLOGY" | "SECURITY" | "LEGAL_COMPLIANCE" | "FOOTBALL_OPS" | "MARKETING",
  "tier": 1 | 2,
  "acceptanceCriteria": string,
  "riskNotes": string,
  "testPlan": string,
  "rollbackPlan": string
}

Rules:
- Create work that keeps operations moving now.
- Avoid duplicates and avoid fictional references.
- Keep each field concise and actionable.`,
    900,
    0.2,
    25_000
  );

  if (!raw) return null;

  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    const ideas = parsed
      .map((item) => {
        const department = String(item?.department ?? "COMMISSIONER");
        const tier = Number(item?.tier ?? 1);
        return {
          title: String(item?.title ?? "").trim(),
          description: String(item?.description ?? "").trim(),
          department,
          tier: tier >= 2 ? 2 : 1,
          acceptanceCriteria: String(item?.acceptanceCriteria ?? "").trim(),
          riskNotes: String(item?.riskNotes ?? "").trim(),
          testPlan: String(item?.testPlan ?? "").trim(),
          rollbackPlan: String(item?.rollbackPlan ?? "").trim(),
        } as ChiefOfStaffTaskIdea;
      })
      .filter((idea) => idea.title && idea.description && idea.acceptanceCriteria && idea.testPlan);

    return ideas.slice(0, Math.max(0, input.desiredCount));
  } catch (error) {
    console.error("[agents][openai] chief-of-staff JSON parse failed:", error);
    return null;
  }
}
