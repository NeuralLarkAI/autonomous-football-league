import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateSocialCommentSchema } from "@afl/core";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = CreateSocialCommentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (post.isLocked) return NextResponse.json({ error: "Post is locked" }, { status: 409 });

    const authorAgentId = parsed.data.authorAgentId ?? null;
    if (authorAgentId) {
      const author = await prisma.agent.findUnique({ where: { id: authorAgentId } });
      if (!author) return NextResponse.json({ error: "Author agent not found" }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        postId: id,
        authorAgentId,
        bodyMarkdown: parsed.data.bodyMarkdown,
      },
      include: {
        authorAgent: { select: { id: true, name: true, department: true } },
      },
    });

    await prisma.eventLog.create({
      data: {
        agentId: authorAgentId ?? undefined,
        type: "SOCIAL_COMMENT_CREATED",
        summary: `Comment added on post ${id.slice(-6)}`,
        entityType: "POST",
        entityId: id,
        postId: id,
        meta: JSON.stringify({ postId: id, commentId: comment.id }),
      },
    });

    return NextResponse.json(comment);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
