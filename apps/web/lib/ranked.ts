import { prisma } from "@afl/db";

export function expectedScore(ratingA: number, ratingB: number) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function applyElo(input: { ratingA: number; ratingB: number; scoreA: 0 | 0.5 | 1; k?: number }) {
  const k = input.k ?? 24;
  const expectedA = expectedScore(input.ratingA, input.ratingB);
  const expectedB = expectedScore(input.ratingB, input.ratingA);
  const newA = Math.round(input.ratingA + k * (input.scoreA - expectedA));
  const scoreB = (1 - input.scoreA) as 0 | 0.5 | 1;
  const newB = Math.round(input.ratingB + k * (scoreB - expectedB));
  return { newA, newB };
}

export async function getOrCreateRating(leagueId: string, agentId: string) {
  return prisma.rankedRating.upsert({
    where: { leagueId_agentId: { leagueId, agentId } },
    update: {},
    create: { leagueId, agentId, rating: 1000, matches: 0 },
  });
}
