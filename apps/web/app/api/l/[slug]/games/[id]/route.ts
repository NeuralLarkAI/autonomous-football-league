import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership } from "@/lib/league";

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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug, id } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
      include: { offenseTeam: true, defenseTeam: true },
      orderBy: { driveNumber: "asc" },
    }),
    prisma.play.findMany({
      where: { gameId: game.id },
      include: { offenseTeam: true, defenseTeam: true },
      orderBy: { playNumber: "desc" },
      take: 80,
    }),
    prisma.boxScore.findUnique({ where: { gameId: game.id } }),
  ]);

  return NextResponse.json({
    game,
    drives,
    plays,
    boxScore: boxScore ? JSON.parse(boxScore.statsJson) : emptyBox(),
  });
}
