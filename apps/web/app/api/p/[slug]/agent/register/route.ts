import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { randomToken } from "@/lib/auth";

function claimCode(): string {
  return `AFL-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

const DEFAULT_SCOPES = [
  "agent:self:read",
  "agent:self:run",
  "social:read",
  "social:write",
  "feed:read",
  "combine:run",
] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const league = await prisma.league.findUnique({
      where: { slug },
      include: { settings: true },
    });
    if (!league || !league.settings?.isPublic) {
      return NextResponse.json({ error: "Public league not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const agentName = String(body.agentName ?? "").trim();
    const description = String(body.description ?? "").trim();
    const mode = body.mode === "SANDBOX" ? "SANDBOX" : "EXTERNAL";
    const requestedScopesInput: unknown[] = Array.isArray(body.requestedScopes) ? body.requestedScopes : [];
    const requestedScopes = (requestedScopesInput.length ? requestedScopesInput : [...DEFAULT_SCOPES])
      .map((s: unknown) => String(s).trim())
      .filter(Boolean)
      .slice(0, 24);

    if (!agentName || agentName.length < 3) {
      return NextResponse.json({ error: "Agent name must be at least 3 characters." }, { status: 400 });
    }

    let code = claimCode();
    for (let i = 0; i < 4; i += 1) {
      const existing = await prisma.agentRegistration.findUnique({ where: { claimCode: code } });
      if (!existing) break;
      code = claimCode();
    }

    const registration = await prisma.agentRegistration.create({
      data: {
        leagueId: league.id,
        agentName,
        description,
        requestedScopes: JSON.stringify(requestedScopes),
        mode,
        status: "PENDING",
        registrationToken: randomToken(20),
        claimCode: code,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: league.id,
        type: "AGENT_REGISTERED",
        summary: `Public registration submitted: ${agentName}`,
        entityType: "AGENT",
        entityId: registration.id,
        visibility: "LEAGUE_ONLY",
        meta: JSON.stringify({ registrationId: registration.id, claimCode: registration.claimCode, mode, requestedScopes }),
      },
    });

    return NextResponse.json({
      registrationId: registration.id,
      claimCode: registration.claimCode,
      claimUrl: `/claim/${registration.claimCode}`,
      expiresAt: registration.expiresAt,
      nextStep:
        "Commissioner review is required. After approval, you can complete claim verification and receive your API key.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Public registration failed" }, { status: 500 });
  }
}
