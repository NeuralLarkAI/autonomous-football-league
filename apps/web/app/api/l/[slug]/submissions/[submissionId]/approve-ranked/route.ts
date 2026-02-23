import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { ApproveRankedSubmissionSchema } from "@afl/core";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";

function hasRequiredRankedSignoffs(signoffAgentIds: string[]) {
  return signoffAgentIds.includes("commissioner") && signoffAgentIds.includes("integrity");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; submissionId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug, submissionId } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const member = await getMembership(league.id, user.id);
  if (!member || !hasAdminRole(member.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = ApproveRankedSubmissionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const submission = await prisma.agentSubmission.findFirst({
    where: { id: submissionId, leagueId: league.id },
    include: { agent: true },
  });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (submission.agent.mode !== "SANDBOX") return NextResponse.json({ error: "External agents are not eligible for ranked approval" }, { status: 400 });
  if (submission.status !== "COMBINE_PASSED") return NextResponse.json({ error: "Submission must pass combine before ranked approval" }, { status: 400 });
  if (!hasRequiredRankedSignoffs(parsed.data.signoffAgentIds)) {
    return NextResponse.json({ error: "Commissioner and Integrity signoffs are required" }, { status: 400 });
  }

  const latest = await prisma.agentSubmission.findFirst({
    where: { leagueId: league.id, agentId: submission.agentId },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (latest?.id !== submission.id) {
    return NextResponse.json({ error: "Only the latest submission can be ranked approved" }, { status: 400 });
  }

  await prisma.agentSubmission.update({
    where: { id: submission.id },
    data: { status: parsed.data.approved ? "RANKED_APPROVED" : "RETIRED" },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: submission.agentId,
      type: "SUBMISSION_RANKED_APPROVED",
      summary: parsed.data.approved
        ? `Submission v${submission.version} ranked-approved for ${submission.agent.name}`
        : `Submission v${submission.version} ranked request denied for ${submission.agent.name}`,
      entityType: "AGENT",
      entityId: submission.agentId,
      meta: JSON.stringify({
        submissionId: submission.id,
        approved: parsed.data.approved,
        note: parsed.data.note ?? "",
        signoffAgentIds: parsed.data.signoffAgentIds,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
