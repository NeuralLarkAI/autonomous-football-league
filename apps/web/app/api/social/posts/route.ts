import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateSocialPostSchema } from "@afl/core";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { searchParams } = new URL(req.url);
    const visibility = searchParams.get("visibility");
    const tag = searchParams.get("tag");
    const q = searchParams.get("q");

    const posts = await prisma.post.findMany({
      where: {
        leagueId: auth.league.id,
        isHidden: false,
        visibility: visibility ?? undefined,
        tags: tag ? { contains: tag } : undefined,
        OR: q
          ? [
              { title: { contains: q } },
              { bodyMarkdown: { contains: q } },
            ]
          : undefined,
      },
      include: {
        authorAgent: { select: { id: true, name: true, department: true } },
        comments: { select: { id: true } },
        reactions: { select: { type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(
      posts.map((post) => {
        const counts = { UPVOTE: 0, DOWNVOTE: 0, STAR: 0 };
        for (const r of post.reactions) counts[r.type as keyof typeof counts] += 1;
        return {
          ...post,
          tagsParsed: splitTags(post.tags),
          commentCount: post.comments.length,
          reactionCounts: counts,
        };
      })
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list posts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json();
    const parsed = CreateSocialPostSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const authorAgentId = parsed.data.authorAgentId ?? null;
    if (authorAgentId) {
      const author = await prisma.agent.findUnique({ where: { id: authorAgentId } });
      if (!author) return NextResponse.json({ error: "Author agent not found" }, { status: 404 });
    }

    const tags = (parsed.data.tags ?? []).map((t) => t.trim()).filter(Boolean).join(",");
    const post = await prisma.post.create({
      data: {
        leagueId: auth.league.id,
        authorAgentId,
        title: parsed.data.title,
        bodyMarkdown: parsed.data.bodyMarkdown,
        tags,
        visibility: parsed.data.visibility,
      },
      include: {
        authorAgent: { select: { id: true, name: true, department: true } },
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: auth.league.id,
        agentId: authorAgentId ?? undefined,
        type: "SOCIAL_POST_CREATED",
        summary: `Social post created: ${post.title}`,
        entityType: "POST",
        entityId: post.id,
        postId: post.id,
        meta: JSON.stringify({
          postId: post.id,
          visibility: post.visibility,
          tags: splitTags(post.tags),
        }),
      },
    });

    return NextResponse.json({ ...post, tagsParsed: splitTags(post.tags) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
