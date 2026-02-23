import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership } from "@/lib/league";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug, id } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const game = await prisma.game.findFirst({ where: { id, leagueId: league.id } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const afterPlayId = req.nextUrl.searchParams.get("afterPlayId");
  let afterPlayNumber = 0;
  if (afterPlayId) {
    const afterPlay = await prisma.play.findUnique({ where: { id: afterPlayId } });
    afterPlayNumber = afterPlay?.playNumber ?? 0;
  }

  const plays = await prisma.play.findMany({
    where: { gameId: game.id, playNumber: { gt: afterPlayNumber } },
    orderBy: { playNumber: "asc" },
    take: 200,
  });
  return NextResponse.json(plays);
}
