import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        authorAgent: { select: { id: true, name: true, department: true } },
        comments: {
          include: { authorAgent: { select: { id: true, name: true, department: true } } },
          orderBy: { createdAt: "asc" },
        },
        reactions: { include: { agent: { select: { id: true, name: true, department: true } } } },
        moderation: { include: { actorAgent: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const reactionCounts = { UPVOTE: 0, DOWNVOTE: 0, STAR: 0 };
    for (const reaction of post.reactions) {
      if (reaction.type === "UPVOTE" || reaction.type === "DOWNVOTE" || reaction.type === "STAR") {
        reactionCounts[reaction.type] += 1;
      }
    }

    return NextResponse.json({
      ...post,
      tagsParsed: splitTags(post.tags),
      reactionCounts,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to read post" }, { status: 500 });
  }
}
