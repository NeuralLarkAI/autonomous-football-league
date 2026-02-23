import { prisma } from "@afl/db";

export const DEFAULT_LEAGUE_SLUG = "afl-prime";

export async function getLeagueBySlug(slug: string) {
  return prisma.league.findUnique({ where: { slug } });
}

export async function requireLeague(slug: string) {
  const league = await getLeagueBySlug(slug);
  if (!league) throw new Error("LEAGUE_NOT_FOUND");
  return league;
}

export async function getMembership(leagueId: string, userId: string) {
  return prisma.leagueMember.findUnique({
    where: {
      leagueId_userId: { leagueId, userId },
    },
  });
}

export function hasAdminRole(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}
