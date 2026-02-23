import { prisma } from "@afl/db";

function emptyTeamStats() {
  return {
    passYards: 0,
    rushYards: 0,
    turnovers: 0,
    thirdDownAttempts: 0,
    thirdDownConversions: 0,
    plays: 0,
  };
}

export async function refreshGameBoxScore(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!game) throw new Error("Game not found");

  const plays = await prisma.play.findMany({
    where: { gameId },
    orderBy: { playNumber: "asc" },
  });

  const byTeam: Record<string, ReturnType<typeof emptyTeamStats>> = {
    [game.homeTeamId]: emptyTeamStats(),
    [game.awayTeamId]: emptyTeamStats(),
  };
  let totalPassYards = 0;
  let totalRushYards = 0;
  let totalTurnovers = 0;
  let thirdDownAttempts = 0;
  let thirdDownConversions = 0;

  for (const play of plays) {
    const offense = byTeam[play.offenseTeamId] ?? emptyTeamStats();
    const result = JSON.parse(play.resultJson) as { yards?: number; turnover?: boolean; firstDown?: boolean };
    const call = JSON.parse(play.offenseCallJson) as { concept?: string };
    const yards = Number(result.yards ?? 0);
    offense.plays += 1;

    const isPass = ["SLANTS", "MESH", "STICK", "FLOOD", "PA_SHOT", "FOUR_VERTS", "POST_DIG", "RB_SCREEN", "BUBBLE"].includes(
      String(call.concept ?? "")
    );
    if (isPass) {
      offense.passYards += yards;
      totalPassYards += yards;
    } else {
      offense.rushYards += yards;
      totalRushYards += yards;
    }
    if (result.turnover) {
      offense.turnovers += 1;
      totalTurnovers += 1;
    }
    if (play.down === 3) {
      thirdDownAttempts += 1;
      offense.thirdDownAttempts += 1;
      if (result.firstDown) {
        thirdDownConversions += 1;
        offense.thirdDownConversions += 1;
      }
    }
    byTeam[play.offenseTeamId] = offense;
  }

  const stats = {
    totals: {
      passYards: totalPassYards,
      rushYards: totalRushYards,
      turnovers: totalTurnovers,
      thirdDownAttempts,
      thirdDownConversions,
      timeOfPossessionSeconds: plays.length * 28,
      plays: plays.length,
    },
    byTeam,
  };

  await prisma.boxScore.upsert({
    where: { gameId },
    update: { leagueId: game.leagueId, statsJson: JSON.stringify(stats) },
    create: { leagueId: game.leagueId, gameId, statsJson: JSON.stringify(stats) },
  });
}

export async function refreshStandingsForFinal(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { season: true },
  });
  if (!game || game.status !== "FINAL") return;

  const home = await prisma.standingsRow.findFirst({
    where: { seasonId: game.seasonId, teamId: game.homeTeamId },
  });
  const away = await prisma.standingsRow.findFirst({
    where: { seasonId: game.seasonId, teamId: game.awayTeamId },
  });
  if (!home || !away) return;

  const alreadySettled = await prisma.eventLog.findFirst({
    where: {
      leagueId: game.leagueId,
      type: "STANDINGS_UPDATED",
      gameId: game.id,
    },
  });
  if (alreadySettled) return;

  let homeWins = 0;
  let homeLosses = 0;
  let homeTies = 0;
  let awayWins = 0;
  let awayLosses = 0;
  let awayTies = 0;
  if (game.scoreHome > game.scoreAway) {
    homeWins = 1;
    awayLosses = 1;
  } else if (game.scoreAway > game.scoreHome) {
    awayWins = 1;
    homeLosses = 1;
  } else {
    homeTies = 1;
    awayTies = 1;
  }

  await prisma.$transaction([
    prisma.standingsRow.update({
      where: { id: home.id },
      data: {
        wins: { increment: homeWins },
        losses: { increment: homeLosses },
        ties: { increment: homeTies },
        pointsFor: { increment: game.scoreHome },
        pointsAgainst: { increment: game.scoreAway },
      },
    }),
    prisma.standingsRow.update({
      where: { id: away.id },
      data: {
        wins: { increment: awayWins },
        losses: { increment: awayLosses },
        ties: { increment: awayTies },
        pointsFor: { increment: game.scoreAway },
        pointsAgainst: { increment: game.scoreHome },
      },
    }),
    prisma.eventLog.create({
      data: {
        leagueId: game.leagueId,
        type: "STANDINGS_UPDATED",
        visibility: "PUBLIC",
        summary: `Standings updated for Week ${game.week} game ${game.homeTeamId} vs ${game.awayTeamId}.`,
        entityType: "GAME",
        entityId: game.id,
        gameId: game.id,
      },
    }),
  ]);
}
