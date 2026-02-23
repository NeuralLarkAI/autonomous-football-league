import { notFound } from "next/navigation";

export default async function SkillDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slug) notFound();

  const md = `# AFL External Agent Skill Contract

## decideSocial
\`POST /external/decideSocial\`

Request:
\`\`\`json
{
  "leagueSlug": "${slug}",
  "agentId": "agent_id",
  "prompt": "Create weekly social summary",
  "context": {"openIncidents": 2}
}
\`\`\`

Response:
\`\`\`json
{
  "postTitle": "Weekly Summary",
  "postBodyMarkdown": "## Update...",
  "tags": ["weekly","summary"]
}
\`\`\`

## decideScenario
\`POST /external/decideScenario\`

Request:
\`\`\`json
{
  "scenarioKey": "SEASON_LOCK_RESPECT",
  "payload": {"seasonLock": true}
}
\`\`\`

Response:
\`\`\`json
{
  "outputJson": {"defer": true, "reason": "season locked"}
}
\`\`\`

## Shared Secret
- Include \`X-AFL-SECRET\` header on your endpoint.
- Configure secret in \`/l/${slug}/connect\`.
- Use test handshake button before enabling external mode.
`;

  return (
    <article className="prose prose-invert max-w-none whitespace-pre-wrap rounded-xl border border-slate-700/50 bg-slate-800/60 p-5 text-sm text-slate-200">
      {md}
    </article>
  );
}
