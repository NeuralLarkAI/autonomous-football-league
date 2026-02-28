import { NextRequest, NextResponse } from "next/server";
import { ListGamesSchema } from "@afl/core";
import { prisma } from "@afl/db";

export async function GET(
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

    const parsed = ListGamesSchema.safeParse({
      week: req.nextUrl.searchParams.get("week") ?? undefined,
      status: req.nextUrl.searchParams.get("status") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const season = await prisma.season.findFirst({
      where: { leagueId: league.id, seasonNumber: 1 },
      orderBy: { createdAt: "desc" },
    });
    if (!season) return NextResponse.json([]);

    const games = await prisma.game.findMany({
      where: {
        leagueId: league.id,
        seasonId: season.id,
        week: parsed.data.week,
        status: parsed.data.status,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
      orderBy: [{ week: "asc" }, { kickoffAt: "asc" }],
    });

    // Only return a minimal public payload (no seed/engine internals).
    return NextResponse.json(
      games.map((g) => ({
        id: g.id,
        week: g.week,
        kickoffAt: g.kickoffAt,
        status: g.status,
        startedAt: g.startedAt,
        finishedAt: g.finishedAt,
        scoreHome: g.scoreHome,
        scoreAway: g.scoreAway,
        homeTeam: { id: g.homeTeam.id, name: g.homeTeam.name, shortName: g.homeTeam.shortName },
        awayTeam: { id: g.awayTeam.id, name: g.awayTeam.name, shortName: g.awayTeam.shortName },
        winnerTeamId: g.winnerTeamId,
        winnerTeam: g.winnerTeam
          ? { id: g.winnerTeam.id, name: g.winnerTeam.name, shortName: g.winnerTeam.shortName }
          : null,
      }))
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

