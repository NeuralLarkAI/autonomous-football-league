import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";
import { storeSubmissionArtifact } from "@/lib/submission-storage";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { slug, id } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const member = await getMembership(league.id, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const submissions = await prisma.agentSubmission.findMany({
    where: { leagueId: league.id, agentId: id },
    include: {
      artifacts: true,
      validations: { orderBy: { createdAt: "desc" }, take: 1 },
      combineRuns: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { version: "desc" },
  });
  return NextResponse.json(submissions);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { slug, id } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const member = await getMembership(league.id, user.id);
  if (!member || !hasAdminRole(member.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const agent = await prisma.agent.findFirst({ where: { id, leagueId: league.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (agent.mode !== "SANDBOX") return NextResponse.json({ error: "Only SANDBOX agents can upload ranked submissions" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
  if (!file.name.endsWith(".js")) return NextResponse.json({ error: "Only .js submission files are supported in v5" }, { status: 400 });

  const latest = await prisma.agentSubmission.findFirst({
    where: { leagueId: league.id, agentId: agent.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeSubmissionArtifact({
    leagueId: league.id,
    agentId: agent.id,
    version: nextVersion,
    filename: file.name || "index.js",
    buffer,
  });

  const submission = await prisma.agentSubmission.create({
    data: {
      leagueId: league.id,
      agentId: agent.id,
      version: nextVersion,
      status: "UPLOADED",
      entryFile: file.name || "index.js",
      checksum: stored.checksum,
      sizeBytes: stored.sizeBytes,
      artifacts: {
        create: {
          leagueId: league.id,
          filePath: stored.filePath,
        },
      },
    },
    include: { artifacts: true },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: agent.id,
      type: "SUBMISSION_UPLOADED",
      summary: `Submission v${submission.version} uploaded for ${agent.name}`,
      entityType: "AGENT",
      entityId: agent.id,
      meta: JSON.stringify({
        submissionId: submission.id,
        version: submission.version,
        sizeBytes: submission.sizeBytes,
        checksum: submission.checksum,
      }),
    },
  });

  return NextResponse.json(submission, { status: 201 });
}
