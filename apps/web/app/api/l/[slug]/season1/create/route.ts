import { NextRequest, NextResponse } from "next/server";
import { CreateSeasonOneSchema } from "@afl/core";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";
import { ensureSeasonOne } from "@/lib/season1";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership || !hasAdminRole(membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = CreateSeasonOneSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await ensureSeasonOne(league.id, parsed.data.teamCount);
  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      type: "GAME_CREATED",
      visibility: "PUBLIC",
      summary: `Season 1 created with ${result.teams.length} teams and ${result.gameCount} scheduled games.`,
      entityType: "SEASON",
      entityId: result.season.id,
      meta: JSON.stringify({
        seasonId: result.season.id,
        seasonNumber: result.season.seasonNumber,
        teamCount: result.teams.length,
        gameCount: result.gameCount,
      }),
    },
  });

  return NextResponse.json({
    seasonId: result.season.id,
    seasonNumber: result.season.seasonNumber,
    teamCount: result.teams.length,
    weeks: result.weeks,
    gameCount: result.gameCount,
  });
}
