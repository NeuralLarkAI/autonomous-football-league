import { NextRequest, NextResponse } from "next/server";
import { ListGamesSchema } from "@afl/core";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership } from "@/lib/league";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  return NextResponse.json(games);
}
