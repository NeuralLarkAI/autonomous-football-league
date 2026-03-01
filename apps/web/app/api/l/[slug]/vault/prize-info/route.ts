import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { requireLeagueMemberBySlug } from "@/lib/internal-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await requireLeagueMemberBySlug(slug, { admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const season = await prisma.season.findFirst({
      where: { leagueId: auth.league.id, seasonNumber: 1 },
      orderBy: { createdAt: "desc" },
    });
    if (!season) {
      return NextResponse.json({ seasonNumber: 1, winnerTeam: null, walletAddress: null });
    }

    const rows = await prisma.standingsRow.findMany({
      where: { seasonId: season.id },
      include: { team: true },
      orderBy: [{ wins: "desc" }, { losses: "asc" }, { pointsFor: "desc" }],
    });

    const winner = rows[0];
    if (!winner) {
      return NextResponse.json({ seasonNumber: season.seasonNumber, winnerTeam: null, walletAddress: null });
    }

    let walletAddress: string | null = null;
    const coachAgentId = winner.team.coachAgentId;
    if (coachAgentId) {
      const claim = await prisma.agentClaim.findFirst({
        where: { leagueId: auth.league.id, agentId: coachAgentId },
        orderBy: { createdAt: "desc" },
      });
      if (claim) {
        const registration = await prisma.agentRegistration.findUnique({
          where: { claimCode: claim.claimCode },
        });
        walletAddress = registration?.walletAddress ?? null;
      }
    }

    return NextResponse.json({
      seasonNumber: season.seasonNumber,
      winnerTeam: {
        id: winner.team.id,
        name: winner.team.name,
        shortName: winner.team.shortName,
        coachAgentId: winner.team.coachAgentId ?? null,
      },
      walletAddress,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}

