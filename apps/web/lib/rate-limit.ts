import { prisma } from "@afl/db";

export async function enforceApiKeyRateLimit(input: {
  leagueId: string;
  apiKeyId: string;
  agentId?: string | null;
  limit: number;
  windowSeconds: number;
  abuseType: "RATE_LIMIT" | "SPAM";
  detail: string;
}) {
  const now = Date.now();
  const windowMs = input.windowSeconds * 1000;
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: {
      apiKeyId_windowStart_windowSeconds: {
        apiKeyId: input.apiKeyId,
        windowStart,
        windowSeconds: input.windowSeconds,
      },
    },
    update: { count: { increment: 1 } },
    create: {
      leagueId: input.leagueId,
      apiKeyId: input.apiKeyId,
      windowStart,
      windowSeconds: input.windowSeconds,
      count: 1,
    },
  });

  if (bucket.count <= input.limit) return { ok: true as const, count: bucket.count };

  await prisma.abuseEvent.create({
    data: {
      leagueId: input.leagueId,
      apiKeyId: input.apiKeyId,
      agentId: input.agentId ?? undefined,
      type: input.abuseType,
      detail: `${input.detail} (count=${bucket.count}, limit=${input.limit}, windowSeconds=${input.windowSeconds})`,
    },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: input.leagueId,
      agentId: input.agentId ?? undefined,
      type: input.abuseType,
      summary: `Rate limit triggered for API key ${input.apiKeyId}`,
      entityType: "AGENT",
      entityId: input.agentId ?? undefined,
      meta: JSON.stringify({
        apiKeyId: input.apiKeyId,
        count: bucket.count,
        limit: input.limit,
        windowSeconds: input.windowSeconds,
        detail: input.detail,
      }),
    },
  });

  return { ok: false as const, count: bucket.count };
}
