import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";
import { randomToken } from "@/lib/auth";

function claimCode(): string {
  return `AFL-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    const { slug } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
    const membership = await getMembership(league.id, user.id);
    if (!membership || !hasAdminRole(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const agentName = String(body.agentName ?? "").trim();
    const description = String(body.description ?? "").trim();
    const requestedScopes = Array.isArray(body.requestedScopes) ? body.requestedScopes.map(String) : [];
    const mode = body.mode === "EXTERNAL" ? "EXTERNAL" : "SANDBOX";
    if (!agentName) return NextResponse.json({ error: "agentName is required" }, { status: 400 });

    let code = claimCode();
    for (let i = 0; i < 4; i++) {
      const exists = await prisma.agentRegistration.findUnique({ where: { claimCode: code } });
      if (!exists) break;
      code = claimCode();
    }
    const token = randomToken(18);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const registration = await prisma.agentRegistration.create({
      data: {
        leagueId: league.id,
        agentName,
        description,
        requestedScopes: JSON.stringify(requestedScopes),
        mode,
        status: "PENDING",
        registrationToken: token,
        claimCode: code,
        expiresAt,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: league.id,
        type: "AGENT_REGISTERED",
        summary: `Agent registration created: ${agentName}`,
        entityType: "AGENT",
        entityId: registration.id,
        meta: JSON.stringify({ registrationId: registration.id, claimCode: registration.claimCode, mode, requestedScopes }),
      },
    });

    return NextResponse.json({
      registrationId: registration.id,
      claimUrl: `/claim/${registration.claimCode}`,
      claimCode: registration.claimCode,
      expiresAt: registration.expiresAt,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
