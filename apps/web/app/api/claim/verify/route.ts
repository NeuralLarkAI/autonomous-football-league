import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser, hashValue } from "@/lib/auth";
import { createApiKeySecret, keyPrefix } from "@/lib/api-key";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const claimCode = String(body.claimCode ?? "").trim();
    const proofType = String(body.proofType ?? "MANUAL");
    const proofValue = body.proofValue ? String(body.proofValue) : null;
    if (!claimCode) return NextResponse.json({ error: "claimCode required" }, { status: 400 });

    const registration = await prisma.agentRegistration.findUnique({
      where: { claimCode },
    });
    if (!registration) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    // Only claimable after commissioner approval.
    if (registration.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Claim is ${registration.status}. Awaiting commissioner approval.` },
        { status: 409 }
      );
    }
    if (registration.expiresAt.getTime() < Date.now()) {
      await prisma.agentRegistration.update({ where: { id: registration.id }, data: { status: "EXPIRED" } });
      return NextResponse.json({ error: "Claim expired" }, { status: 410 });
    }

    // Allow self-service onboarding after approval: auto-enroll the claimant as a VIEWER member if needed.
    let membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: registration.leagueId, userId: user.id } },
    });
    if (!membership) {
      membership = await prisma.leagueMember.create({
        data: { leagueId: registration.leagueId, userId: user.id, role: "VIEWER" },
      });
    }

    const requestedScopes = JSON.parse(registration.requestedScopes || "[]") as string[];
    const agent = await prisma.agent.create({
      data: {
        leagueId: registration.leagueId,
        ownerUserId: user.id,
        name: registration.agentName,
        role: "Connected External Agent",
        department: "TECHNOLOGY",
        status: "ACTIVE",
        permissions: JSON.stringify({
          canCreateTasks: false,
          canCreateProposals: false,
          maxProposalTier: 0,
          canApprove: false,
          canViewFinancials: false,
          canModifyRules: false,
        }),
        roleCardMd: `# ${registration.agentName}\n\nConnected via claim flow.`,
        permissionScopes: JSON.stringify(requestedScopes),
        kpis: JSON.stringify({ tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 }),
        mode: registration.mode,
      },
    });

    const secret = createApiKeySecret();
    const apiKey = await prisma.apiKey.create({
      data: {
        leagueId: registration.leagueId,
        agentId: agent.id,
        name: `${agent.name} default key`,
        keyHash: hashValue(secret),
        prefix: keyPrefix(secret),
        scopes: {
          create: requestedScopes.map((scope) => ({ scope })),
        },
      },
      include: { scopes: true },
    });

    const claim = await prisma.agentClaim.create({
      data: {
        leagueId: registration.leagueId,
        agentId: agent.id,
        ownerUserId: user.id,
        claimCode,
        proofType: proofType || "MANUAL",
        proofValue,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    });

    await prisma.agentRegistration.update({
      where: { id: registration.id },
      data: { status: "CLAIMED" },
    });

    await prisma.eventLog.createMany({
      data: [
        {
          leagueId: registration.leagueId,
          agentId: agent.id,
          type: "AGENT_CLAIMED",
          summary: `Agent claimed: ${agent.name}`,
          entityType: "AGENT",
          entityId: agent.id,
          meta: JSON.stringify({ claimId: claim.id, claimCode }),
        },
        {
          leagueId: registration.leagueId,
          agentId: agent.id,
          type: "AGENT_VERIFIED",
          summary: `Agent claim verified: ${agent.name}`,
          entityType: "AGENT",
          entityId: agent.id,
          meta: JSON.stringify({ proofType, claimId: claim.id }),
        },
      ],
    });

    return NextResponse.json({
      agent: { id: agent.id, name: agent.name, mode: agent.mode, ownerUserId: agent.ownerUserId },
      apiKey: {
        key: secret,
        prefix: apiKey.prefix,
        scopes: apiKey.scopes.map((s) => s.scope),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Claim verification failed" }, { status: 500 });
  }
}
