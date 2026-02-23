import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RunSubmissionCombineSchema } from "@afl/core";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";
import { runSubmissionCombine } from "@/lib/submission-combine";

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
    include: { agent: true, validations: { orderBy: { createdAt: "desc" }, take: 1 }, artifacts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (submission.status === "INVALID") return NextResponse.json({ error: "Submission is invalid and cannot run combine" }, { status: 400 });

  const parsed = RunSubmissionCombineSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const seed = parsed.data.seed ?? 42;

  await prisma.agentSubmission.update({
    where: { id: submission.id },
    data: { status: "COMBINE_PENDING" },
  });

  const artifact = submission.artifacts[0];
  if (!artifact) return NextResponse.json({ error: "Submission artifact missing" }, { status: 400 });

  const result = await runSubmissionCombine({
    leagueId: league.id,
    agentId: submission.agentId,
    submissionId: submission.id,
    artifactPath: artifact.filePath,
    runType: "COMBINE",
    seed,
  });

  const passed = result.passedGate;
  await prisma.agentSubmission.update({
    where: { id: submission.id },
    data: { status: passed ? "COMBINE_PASSED" : "COMBINE_FAILED" },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: submission.agentId,
      type: "SUBMISSION_COMBINE_RUN",
      summary: `Submission v${submission.version} combine ${passed ? "passed" : "failed"} for ${submission.agent.name}`,
      entityType: "COMBINE_RUN",
      entityId: result.combineRunId,
      combineRunId: result.combineRunId,
      meta: JSON.stringify({
        submissionId: submission.id,
        scoreOverall: result.scoreOverall,
        scoreReliability: result.scoreReliability,
        scoreLatency: result.scoreLatency,
      }),
    },
  });

  return NextResponse.json({ ...result, passed });
}
