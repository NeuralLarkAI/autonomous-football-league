import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { ModerateSocialSchema } from "@afl/core";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

const MODERATOR_IDS = new Set(["commissioner", "community-moderation"]);

function canModerate(actorAgentId?: string): boolean {
  if (!actorAgentId) return true; // commissioner action from UI
  return MODERATOR_IDS.has(actorAgentId);
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json();
    const parsed = ModerateSocialSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { targetType, targetId, action, reason, actorAgentId, tags } = parsed.data;
    if (!canModerate(actorAgentId)) {
      return NextResponse.json({ error: "Only commissioner or community moderation agent can moderate." }, { status: 403 });
    }

    let postId: string | null = null;
    let commentId: string | null = null;

    if (targetType === "POST") {
      const post = await prisma.post.findUnique({ where: { id: targetId } });
      if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
      if (post.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      postId = post.id;

      if (action === "HIDE") {
        await prisma.post.update({ where: { id: post.id }, data: { isHidden: true } });
      } else if (action === "UNHIDE") {
        await prisma.post.update({ where: { id: post.id }, data: { isHidden: false } });
      } else if (action === "LOCK") {
        await prisma.post.update({ where: { id: post.id }, data: { isLocked: true } });
      } else if (action === "UNLOCK") {
        await prisma.post.update({ where: { id: post.id }, data: { isLocked: false } });
      } else if (action === "TAG") {
        const merged = new Set([...parseTags(post.tags), ...(tags ?? [])]);
        await prisma.post.update({ where: { id: post.id }, data: { tags: Array.from(merged).join(",") } });
      }
    } else {
      const comment = await prisma.comment.findUnique({ where: { id: targetId } });
      if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      if (comment.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      commentId = comment.id;
      postId = comment.postId;
    }

    const moderation = await prisma.moderationAction.create({
      data: {
        leagueId: auth.league.id,
        targetType,
        targetId,
        action,
        reason: reason ?? "",
        actorAgentId: actorAgentId ?? null,
        postId,
        commentId,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: auth.league.id,
        agentId: actorAgentId ?? undefined,
        type: "SOCIAL_MODERATION_ACTION",
        summary: `${action} ${targetType.toLowerCase()} ${targetId.slice(-6)}`,
        entityType: "POST",
        entityId: postId ?? targetId,
        postId: postId ?? undefined,
        meta: JSON.stringify({
          moderationId: moderation.id,
          targetType,
          targetId,
          action,
          reason: reason ?? "",
        }),
      },
    });

    return NextResponse.json(moderation);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Moderation failed" }, { status: 500 });
  }
}
