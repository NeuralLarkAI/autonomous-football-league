import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RequestRankedSubmissionSchema } from "@afl/core";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";

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

  const submission = await prisma.agentSubmission.findFirst({
    where: { id: submissionId, leagueId: league.id },
    include: { agent: true },
  });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (submission.status !== "COMBINE_PASSED") {
    return NextResponse.json({ error: "Submission must pass combine before ranked request" }, { status: 400 });
  }

  const parsed = RequestRankedSubmissionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.agentSubmission.update({
    where: { id: submission.id },
    data: { status: "COMBINE_PASSED" },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: submission.agentId,
      type: "SUBMISSION_RANKED_REQUESTED",
      summary: `Ranked approval requested for ${submission.agent.name} submission v${submission.version}`,
      entityType: "AGENT",
      entityId: submission.agentId,
      meta: JSON.stringify({ submissionId: submission.id, note: parsed.data.note ?? "" }),
    },
  });

  return NextResponse.json({ ok: true });
}
