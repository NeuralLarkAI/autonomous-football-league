import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateSocialReactionSchema } from "@afl/core";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = CreateSocialReactionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (post.isLocked) return NextResponse.json({ error: "Post is locked" }, { status: 409 });

    const agentId = parsed.data.agentId ?? null;
    if (agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const reaction = await prisma.reaction.create({
      data: {
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
