import crypto from "node:crypto";
import { prisma } from "@afl/db";

export const SEASON1_ENGINE_VERSION = "engine@0.1.0";

const TEAM_DEFAULTS = [
  { name: "Apex Comets", shortName: "APX", color: "#38bdf8", schemeOffense: "SPREAD", schemeDefense: "ZONE", coachAgentId: "program-manager" },
  { name: "Byte Hawks", shortName: "BYT", color: "#f97316", schemeOffense: "WEST_COAST", schemeDefense: "MAN", coachAgentId: "architect" },
  { name: "Cipher Guard", shortName: "CGR", color: "#ef4444", schemeOffense: "POWER", schemeDefense: "BLITZ", coachAgentId: "security" },
  { name: "Delta Forge", shortName: "DLT", color: "#22c55e", schemeOffense: "VERTICAL", schemeDefense: "SHELL", coachAgentId: "sre" },
  { name: "Echo Knights", shortName: "EKO", color: "#a855f7", schemeOffense: "SPREAD", schemeDefense: "ZONE", coachAgentId: "qa-engineer" },
  { name: "Flux Rangers", shortName: "FLX", color: "#14b8a6", schemeOffense: "WEST_COAST", schemeDefense: "ZONE", coachAgentId: "backend-engineer" },
  { name: "Grid Titans", shortName: "GRD", color: "#facc15", schemeOffense: "POWER", schemeDefense: "MAN", coachAgentId: "scheduler" },
  { name: "Helix Blaze", shortName: "HLX", color: "#fb7185", schemeOffense: "VERTICAL", schemeDefense: "SHELL", coachAgentId: "rankings" },
] as const;

type TeamSeed = (typeof TEAM_DEFAULTS)[number];

function roundRobinPairings(teamIds: string[]): Array<Array<{ homeTeamId: string; awayTeamId: string }>> {
  if (teamIds.length % 2 !== 0) throw new Error("Team count must be even");
  const teams = [...teamIds];
  const rounds = teams.length - 1;
  const weeks: Array<Array<{ homeTeamId: string; awayTeamId: string }>> = [];
  for (let round = 0; round < rounds; round += 1) {
    const weekGames: Array<{ homeTeamId: string; awayTeamId: string }> = [];
    for (let i = 0; i < teams.length / 2; i += 1) {
      const a = teams[i];
      const b = teams[teams.length - 1 - i];
      const homeTeamId = (round + i) % 2 === 0 ? a : b;
      const awayTeamId = (round + i) % 2 === 0 ? b : a;
      weekGames.push({ homeTeamId, awayTeamId });
    }
    weeks.push(weekGames);
    const fixed = teams[0];
    const rotating = teams.slice(1);
    const last = rotating.pop()!;
    rotating.unshift(last);
    teams.splice(0, teams.length, fixed, ...rotating);
  }
  return weeks;
}

function deterministicGameSeed(seasonNumber: number, week: number, homeTeamId: string, awayTeamId: string): string {
  return crypto
    .createHash("sha256")
    .update(`season:${seasonNumber}|week:${week}|home:${homeTeamId}|away:${awayTeamId}`)
    .digest("hex")
    .slice(0, 16);
}

export async function ensureSeasonOne(leagueId: string, requestedTeamCount = 8) {
  const agentIds = new Set(
    (await prisma.agent.findMany({ where: { leagueId }, select: { id: true } })).map((a) => a.id)
  );
  const teamSeeds: TeamSeed[] = TEAM_DEFAULTS.slice(0, Math.max(2, Math.min(requestedTeamCount, TEAM_DEFAULTS.length)));
  if (teamSeeds.length % 2 !== 0) teamSeeds.pop();

  const teams: Array<{ id: string; name: string; shortName: string }> = [];
  for (const seed of teamSeeds) {
    const coachAgentId = seed.coachAgentId && agentIds.has(seed.coachAgentId) ? seed.coachAgentId : null;
    const team = await prisma.team.upsert({
      where: { leagueId_shortName: { leagueId, shortName: seed.shortName } },
      update: {
        name: seed.name,
        color: seed.color,
        schemeOffense: seed.schemeOffense,
        schemeDefense: seed.schemeDefense,
        coachAgentId,
      },
      create: {
        leagueId,
        name: seed.name,
        shortName: seed.shortName,
        color: seed.color,
        schemeOffense: seed.schemeOffense,
        schemeDefense: seed.schemeDefense,
        coachAgentId,
      },
      select: { id: true, name: true, shortName: true },
    });
    teams.push(team);
  }

  const season = await prisma.season.upsert({
    where: { leagueId_seasonNumber: { leagueId, seasonNumber: 1 } },
    update: {
      engineVersion: SEASON1_ENGINE_VERSION,
      status: "PLANNED",
    },
    create: {
      leagueId,
      seasonNumber: 1,
      engineVersion: SEASON1_ENGINE_VERSION,
      status: "PLANNED",
    },
  });

  for (const team of teams) {
    await prisma.standingsRow.upsert({
      where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } },
      update: {},
      create: {
        leagueId,
        seasonId: season.id,
        teamId: team.id,
      },
    });
  }

  const kickoffBase = new Date("2026-09-06T17:00:00.000Z");
  const weeks = roundRobinPairings(teams.map((t) => t.id));
  let gameCount = 0;
  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    for (const [offset, pairing] of weeks[weekIndex].entries()) {
      const week = weekIndex + 1;
      const kickoffAt = new Date(kickoffBase.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000 + offset * 2 * 60 * 60 * 1000);
      await prisma.game.upsert({
        where: {
          seasonId_week_homeTeamId_awayTeamId: {
            seasonId: season.id,
            week,
            homeTeamId: pairing.homeTeamId,
            awayTeamId: pairing.awayTeamId,
          },
        },
        update: {
          leagueId,
          kickoffAt,
          status: "SCHEDULED",
          seed: deterministicGameSeed(1, week, pairing.homeTeamId, pairing.awayTeamId),
          engineVersion: SEASON1_ENGINE_VERSION,
        },
        create: {
          leagueId,
          seasonId: season.id,
          week,
          kickoffAt,
          homeTeamId: pairing.homeTeamId,
          awayTeamId: pairing.awayTeamId,
          status: "SCHEDULED",
          seed: deterministicGameSeed(1, week, pairing.homeTeamId, pairing.awayTeamId),
          engineVersion: SEASON1_ENGINE_VERSION,
        },
      });
      gameCount += 1;
    }
  }

  return { season, teams, gameCount, weeks: weeks.length };
}
