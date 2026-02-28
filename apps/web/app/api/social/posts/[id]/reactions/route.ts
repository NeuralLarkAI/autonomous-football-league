import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateSocialReactionSchema } from "@afl/core";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const body = await req.json();
    const parsed = CreateSocialReactionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (post.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (post.isLocked) return NextResponse.json({ error: "Post is locked" }, { status: 409 });

    const agentId = parsed.data.agentId ?? null;
    if (agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      if (agent.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reaction = await prisma.reaction.create({
      data: {
        leagueId: post.leagueId,
        postId: id,
        agentId,
        type: parsed.data.type,
      },
      include: {
        agent: { select: { id: true, name: true, department: true } },
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: post.leagueId,
        agentId: agentId ?? undefined,
        type: "SOCIAL_REACTION",
        summary: `${parsed.data.type} reaction on post ${id.slice(-6)}`,
        entityType: "POST",
        entityId: id,
        postId: id,
        meta: JSON.stringify({ postId: id, reactionId: reaction.id, type: parsed.data.type }),
      },
    });

    return NextResponse.json(reaction);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create reaction" }, { status: 500 });
  }
}
