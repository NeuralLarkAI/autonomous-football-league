type AgentNarrativeInput = {
  agentName: string;
  goal: string;
  context: string;
};

function getClaudeConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? "";
  const model = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-latest";
  return { apiKey, model };
}

export function hasClaudeAgentBrain(): boolean {
  return Boolean(getClaudeConfig().apiKey);
}

export async function generateAgentNarrative(input: AgentNarrativeInput): Promise<string | null> {
  const { apiKey, model } = getClaudeConfig();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
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
        max_tokens: 500,
        temperature: 0.2,
        system:
          "You are an operations-focused sports league commissioner agent. Be concise, concrete, and action-oriented. Do not reveal secrets.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Agent: ${input.agentName}\nGoal: ${input.goal}\nContext:\n${input.context}\n\nProduce markdown with clear bullets.`,
              },
            ],
          },
        ],
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
