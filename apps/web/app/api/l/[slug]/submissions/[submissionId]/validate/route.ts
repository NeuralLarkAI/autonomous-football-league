import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";
import { fileExists, readArtifactAsText } from "@/lib/submission-storage";
import { runSandboxDecide } from "@/lib/sandbox-runner";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
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
    include: { agent: true, artifacts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  await prisma.agentSubmission.update({ where: { id: submission.id }, data: { status: "VALIDATING" } });
  const warnings: string[] = [];
  const errors: string[] = [];

  const artifact = submission.artifacts[0];
  if (!artifact) {
    errors.push("No artifact found for submission.");
  } else if (!(await fileExists(artifact.filePath))) {
    errors.push(`Artifact file missing on disk: ${artifact.filePath}`);
  }

  if (errors.length === 0 && artifact) {
    const source = await readArtifactAsText(artifact.filePath);
    if (!source.includes("decide")) warnings.push("No obvious decide symbol found in source.");
    const exec = await runSandboxDecide({
      sourceCode: source,
      seed: 42,
      payload: { scenarioKey: "SCHEMA_VALIDATE_TASK", input: { title: "Validation task" } },
    });
    if (!exec.ok) {
      errors.push(exec.error ?? "Execution failed during validation.");
    } else if (exec.durationMs > 50) {
      warnings.push(`Execution exceeded target budget (${exec.durationMs}ms > 50ms).`);
    }
  }

  const ok = errors.length === 0;
  await prisma.validationResult.create({
    data: {
      leagueId: league.id,
      submissionId: submission.id,
      ok,
      errorsJson: JSON.stringify(errors),
      warningsJson: JSON.stringify(warnings),
    },
  });

  await prisma.agentSubmission.update({
    where: { id: submission.id },
    data: { status: ok ? "VALID" : "INVALID" },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: submission.agentId,
      type: ok ? "SUBMISSION_VALIDATED" : "SUBMISSION_INVALID",
      summary: ok
        ? `Submission v${submission.version} validated for ${submission.agent.name}`
        : `Submission v${submission.version} invalid for ${submission.agent.name}`,
      entityType: "AGENT",
      entityId: submission.agentId,
      meta: JSON.stringify({ submissionId: submission.id, errors, warnings }),
    },
  });

  return NextResponse.json({ ok, errors, warnings });
}
