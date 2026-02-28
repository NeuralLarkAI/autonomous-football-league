import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

function emptyBox() {
  return {
    totals: {
      passYards: 0,
      rushYards: 0,
      turnovers: 0,
      thirdDownAttempts: 0,
      thirdDownConversions: 0,
      timeOfPossessionSeconds: 0,
      plays: 0,
    },
    byTeam: {},
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
    if (!league || !league.settings?.isPublic) {
      return NextResponse.json({ error: "Public league not found" }, { status: 404 });
    }

    const game = await prisma.game.findFirst({
      where: { id, leagueId: league.id },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
        season: true,
      },
    });
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    const [drives, plays, boxScore] = await Promise.all([
      prisma.drive.findMany({
        where: { gameId: game.id },
        include: { offenseTeam: { select: { id: true, shortName: true, name: true } }, defenseTeam: { select: { id: true, shortName: true, name: true } } },
        orderBy: { driveNumber: "asc" },
      }),
      prisma.play.findMany({
        where: { gameId: game.id },
        include: {
          offenseTeam: { select: { id: true, shortName: true, name: true } },
          defenseTeam: { select: { id: true, shortName: true, name: true } },
        },
        orderBy: { playNumber: "desc" },
        take: 120,
      }),
      prisma.boxScore.findUnique({ where: { gameId: game.id } }),
    ]);

    return NextResponse.json({
      game: {
        id: game.id,
        week: game.week,
        kickoffAt: game.kickoffAt,
        status: game.status,
        startedAt: game.startedAt,
        finishedAt: game.finishedAt,
        scoreHome: game.scoreHome,
        scoreAway: game.scoreAway,
        homeTeam: { id: game.homeTeam.id, shortName: game.homeTeam.shortName, name: game.homeTeam.name },
        awayTeam: { id: game.awayTeam.id, shortName: game.awayTeam.shortName, name: game.awayTeam.name },
        winnerTeamId: game.winnerTeamId,
      },
      drives: drives.map((d) => ({
        id: d.id,
        driveNumber: d.driveNumber,
        startQtr: d.startQtr,
        startTimeSeconds: d.startTimeSeconds,
        startYardLine: d.startYardLine,
        endReason: d.endReason,
        points: d.points,
        offenseTeam: d.offenseTeam,
        defenseTeam: d.defenseTeam,
      })),
      plays: plays.map((p) => ({
        id: p.id,
        playNumber: p.playNumber,
        qtr: p.qtr,
        timeSeconds: p.timeSeconds,
        down: p.down,
        distance: p.distance,
        yardLine: p.yardLine,
        description: p.description,
        resultJson: p.resultJson,
        offenseTeam: p.offenseTeam,
        defenseTeam: p.defenseTeam,
      })),
      boxScore: boxScore ? JSON.parse(boxScore.statsJson) : emptyBox(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

