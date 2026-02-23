import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership } from "@/lib/league";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [registrations, agents] = await Promise.all([
    prisma.agentRegistration.findMany({
      where: { leagueId: league.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.agent.findMany({
      where: { leagueId: league.id },
      include: {
        apiKeys: { include: { scopes: true }, orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({
    league: { id: league.id, slug: league.slug, name: league.name },
    role: membership.role,
    registrations: registrations.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      claimCode: r.claimCode,
      status: r.status,
      mode: r.mode,
      expiresAt: r.expiresAt,
      requestedScopes: JSON.parse(r.requestedScopes || "[]"),
    })),
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      mode: a.mode,
      externalEndpointUrl: a.externalEndpointUrl,
      ownerUserId: a.ownerUserId,
      keys: a.apiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        revokedAt: k.revokedAt,
        lastUsedAt: k.lastUsedAt,
        scopes: k.scopes.map((s) => s.scope),
      })),
    })),
  });
}
