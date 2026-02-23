import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@afl/db";
import { enforceScope } from "@/lib/api-key";
import { requireLeague } from "@/lib/league";
import { enforceApiKeyRateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const league = await requireLeague(slug);
  const authz = await enforceScope({
    req,
    leagueId: league.id,
    requiredScope: "social:read",
    denySummary: "Denied social read for external agent",
  });
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const posts = await prisma.post.findMany({
    where: { leagueId: league.id, isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(posts);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const league = await requireLeague(slug);
  const authz = await enforceScope({
    req,
    leagueId: league.id,
    requiredScope: "social:write",
    denySummary: "Denied social write for external agent",
  });
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const rl = await enforceApiKeyRateLimit({
    leagueId: league.id,
    apiKeyId: authz.principal.apiKeyId,
    agentId: authz.principal.agentId,
    limit: 20,
    windowSeconds: 60,
    abuseType: "RATE_LIMIT",
    detail: "social:write per-minute limit exceeded",
  });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const bodyMarkdown = String(body.bodyMarkdown ?? "").trim();
  if (!title || !bodyMarkdown) return NextResponse.json({ error: "title/bodyMarkdown required" }, { status: 400 });
  const tags = Array.isArray(body.tags) ? body.tags.map(String).join(",") : "";
  const visibility = body.visibility === "PUBLIC" ? "PUBLIC" : "LEAGUE_ONLY";
  const contentHash = crypto.createHash("sha256").update(`${title}\n${bodyMarkdown}`).digest("hex");

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const duplicates = await prisma.post.count({
    where: {
      leagueId: league.id,
      authorAgentId: authz.principal.agentId ?? undefined,
      createdAt: { gte: oneHourAgo },
      title,
      bodyMarkdown,
    },
  });
  if (duplicates >= 3) {
    await prisma.abuseEvent.create({
      data: {
        leagueId: league.id,
        apiKeyId: authz.principal.apiKeyId,
        agentId: authz.principal.agentId ?? undefined,
        type: "SPAM",
        detail: `Duplicate social content hash=${contentHash} repeated ${duplicates + 1} times in the last hour.`,
      },
    });
    await prisma.eventLog.create({
      data: {
        leagueId: league.id,
        agentId: authz.principal.agentId ?? undefined,
        type: "SPAM",
        summary: "Social post blocked by anti-spam duplicate-content rule",
        entityType: "AGENT",
        entityId: authz.principal.agentId ?? undefined,
        meta: JSON.stringify({ contentHash, duplicates }),
      },
    });
    return NextResponse.json({ error: "Duplicate content spam protection triggered" }, { status: 429 });
  }

  const post = await prisma.post.create({
    data: {
      leagueId: league.id,
      authorAgentId: authz.principal.agentId ?? null,
      title,
      bodyMarkdown,
      tags,
      visibility,
    },
  });
  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: authz.principal.agentId ?? undefined,
      type: "SOCIAL_POST_CREATED",
      summary: `External agent posted: ${title}`,
      entityType: "POST",
      entityId: post.id,
      postId: post.id,
      meta: JSON.stringify({ via: "api_key" }),
    },
  });
  return NextResponse.json(post);
}
