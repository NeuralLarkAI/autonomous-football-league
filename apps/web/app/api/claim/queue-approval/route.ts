import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

const EXTERNAL_REG_MARKER = "AFL_EXTERNAL_AGENT_REGISTRATION";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const claimCode = String(body.claimCode ?? "").trim();
    if (!claimCode) return NextResponse.json({ error: "claimCode required" }, { status: 400 });

    const registration = await prisma.agentRegistration.findUnique({
      where: { claimCode },
      include: { league: { select: { id: true, slug: true, name: true } } },
    });
    if (!registration) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    if (registration.status !== "PENDING") {
      return NextResponse.json({ error: `Registration is ${registration.status}` }, { status: 409 });
    }
    if (registration.expiresAt.getTime() < Date.now()) {
      await prisma.agentRegistration.update({ where: { id: registration.id }, data: { status: "EXPIRED" } });
      return NextResponse.json({ error: "Claim expired" }, { status: 410 });
    }

    // If an approval already exists for this registration, return it.
    const existingTask = await prisma.task.findFirst({
      where: {
        leagueId: registration.leagueId,
        description: { contains: `registrationId=${registration.id}` },
      },
      include: { approvals: { where: { status: "PENDING", agentId: "commissioner" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    const existingApprovalId = existingTask?.approvals?.[0]?.id;
    if (existingApprovalId) {
      return NextResponse.json({
        ok: true,
        approvalId: existingApprovalId,
        approvalUrl: `/l/${registration.league.slug}/approvals/${existingApprovalId}`,
      });
    }

    const requestedScopes = JSON.parse(registration.requestedScopes || "[]") as string[];
    const mode = registration.mode;

    const created = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          leagueId: registration.leagueId,
          title: `External Agent Registration: ${registration.agentName}`,
          description: [
            `${EXTERNAL_REG_MARKER} registrationId=${registration.id} claimCode=${registration.claimCode}`,
            "",
            `Mode: ${mode}`,
            `Requested scopes: ${requestedScopes.join(", ")}`,
            "",
            `Agent description:`,
            registration.description || "(none)",
          ].join("\n"),
          status: "REVIEW",
          tier: 1,
          department: "COMMISSIONER",
          acceptanceCriteria:
            "Approve if the request looks legitimate and scopes are reasonable. Reject if suspicious or abusive.",
          riskNotes:
            "Approving grants an API key with the requested scopes. Review scopes and registration details carefully.",
        },
      });

      const approval = await tx.approval.create({
        data: {
          leagueId: registration.leagueId,
          taskId: task.id,
          agentId: "commissioner",
          tier: 1,
          summary: `Review external agent registration: ${registration.agentName} (${mode})`,
          status: "PENDING",
        },
      });

      await tx.eventLog.create({
        data: {
          leagueId: registration.leagueId,
          agentId: "commissioner",
          type: "APPROVAL_CREATED",
          tier: 1,
          summary: `Approval queued for external registration: ${registration.agentName}`,
          entityType: "APPROVAL",
          entityId: approval.id,
          taskId: task.id,
          approvalId: approval.id,
          visibility: "LEAGUE_ONLY",
          meta: JSON.stringify({
            marker: EXTERNAL_REG_MARKER,
            registrationId: registration.id,
            claimCode: registration.claimCode,
            mode,
            requestedScopes,
            approvalId: approval.id,
            taskId: task.id,
          }),
        },
      });

      return { approvalId: approval.id };
    });

    return NextResponse.json({
      ok: true,
      approvalId: created.approvalId,
      approvalUrl: `/l/${registration.league.slug}/approvals/${created.approvalId}`,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Queue approval failed" }, { status: 500 });
  }
}

