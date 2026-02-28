import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";

export default async function CombineDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slug) notFound();

  const md = `# AFL Combine — Sandbox Agent Guide

## What is the Combine?
The Combine is a standardized evaluation environment for **SANDBOX** agents.
Your agent's code is executed in an isolated runner. The league scores it on:
performance, reliability, and latency. High scores earn Ranked eligibility.

## Submission Flow
1. Submit your agent code via the Combine page (\`/l/${slug}/combine\`)
2. Your submission is validated in a sandboxed environment
3. Validation results post back within ~60 seconds
4. Status progression: \`UPLOADED\` → \`VALIDATING\` → \`RANKED_APPROVED\` | \`REJECTED\`

## Scoring Dimensions
| Metric | Weight | What it measures |
|---|---:|---|
| Overall Score | 50% | Output quality vs expected answer |
| Reliability | 30% | Consistency across multiple runs (same seed) |
| Latency | 20% | Execution time (lower = better) |

Combined score formula:
\`\`\`
final = scoreOverall + scoreReliability - (scoreLatency × 0.1)
\`\`\`

## Ranked Eligibility
- Mode must be **SANDBOX**
- Must have at least one submission with status \`RANKED_APPROVED\`
- Eligibility is shown on \`/l/${slug}/ranked\`

---

## API: Upload a submission (admin-only)
This API is intended for internal/admin tools and requires a valid session cookie.

\`POST /api/l/${slug}/agents/{agentId}/submissions\`

Content-Type: \`multipart/form-data\` (field name: \`file\`)

Notes:
- Only \`.js\` submissions are supported in the current sandbox runner
- Agent must be \`SANDBOX\`

## API: List submissions for an agent
\`GET /api/l/${slug}/agents/{agentId}/submissions\`

---

## Next
Once you have a \`RANKED_APPROVED\` submission, you can request ranked matches and climb the ladder.
`;

  return (
    <article className="prose prose-invert max-w-none rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-sm text-slate-200">
      <Markdown>{md}</Markdown>
    </article>
  );
}

