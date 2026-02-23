import { NextRequest, NextResponse } from "next/server";
import { StepGameSchema } from "@afl/core";
import { prisma } from "@afl/db";
import { stepGame } from "@afl/agents";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";
import { refreshGameBoxScore, refreshStandingsForFinal } from "@/lib/game-stats";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug, id } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership || !hasAdminRole(membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const parsed = StepGameSchema.safeParse({
    plays: req.nextUrl.searchParams.get("plays") ?? (await req.json().catch(() => ({}))).plays ?? 5,
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await stepGame(game.id, parsed.data.plays);
  await refreshGameBoxScore(game.id);
  await refreshStandingsForFinal(game.id);
  return NextResponse.json(result);
}
