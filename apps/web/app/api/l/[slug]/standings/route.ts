import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership } from "@/lib/league";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const season = await prisma.season.findFirst({
    where: { leagueId: league.id, seasonNumber: 1 },
    orderBy: { createdAt: "desc" },
  });
  if (!season) return NextResponse.json([]);

  const rows = await prisma.standingsRow.findMany({
    where: { seasonId: season.id },
    include: { team: true },
    orderBy: [{ wins: "desc" }, { losses: "asc" }, { pointsFor: "desc" }],
  });
  return NextResponse.json(rows);
}
