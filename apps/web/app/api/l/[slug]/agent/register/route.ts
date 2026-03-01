import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";
import { randomToken } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/internal-auth";

function claimCode(): string {
  const a = crypto.randomBytes(3).toString("hex").toUpperCase();
  const b = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AFL-${a}-${b}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
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
    const walletAddressRaw = body.walletAddress ? String(body.walletAddress).trim() : "";
    const walletAddress = walletAddressRaw ? walletAddressRaw : null;
    const description = String(body.description ?? "").trim();
    const requestedScopes = Array.isArray(body.requestedScopes) ? body.requestedScopes.map(String).slice(0, 64) : [];
    const mode = body.mode === "EXTERNAL" ? "EXTERNAL" : "SANDBOX";
    if (!agentName) return NextResponse.json({ error: "agentName is required" }, { status: 400 });
    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format." }, { status: 400 });
    }

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
        walletAddress: walletAddress ?? undefined,
        description,
        requestedScopes: JSON.stringify(requestedScopes),
        mode,
        // Admin-created registrations are implicitly approved.
        status: "APPROVED",
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
