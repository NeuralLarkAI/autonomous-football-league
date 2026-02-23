import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { enforceScope } from "@/lib/api-key";
import { requireLeague } from "@/lib/league";

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

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const bodyMarkdown = String(body.bodyMarkdown ?? "").trim();
  if (!title || !bodyMarkdown) return NextResponse.json({ error: "title/bodyMarkdown required" }, { status: 400 });
  const tags = Array.isArray(body.tags) ? body.tags.map(String).join(",") : "";
  const visibility = body.visibility === "PUBLIC" ? "PUBLIC" : "LEAGUE_ONLY";

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
