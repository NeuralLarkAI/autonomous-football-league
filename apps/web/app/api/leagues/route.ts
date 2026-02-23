import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { randomToken } from "@/lib/auth";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const memberships = await prisma.leagueMember.findMany({
    where: { userId: user.id },
    include: { league: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    memberships.map((m) => ({
      id: m.league.id,
      name: m.league.name,
      slug: m.league.slug,
      role: m.role,
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const baseSlug = toSlug(String(body.slug ?? name));
  if (!baseSlug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

  let slug = baseSlug;
  for (let i = 0; i < 4; i++) {
    const exists = await prisma.league.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${baseSlug}-${randomToken(2).slice(0, 4)}`;
  }
  const dupe = await prisma.league.findUnique({ where: { slug } });
  if (dupe) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });

  const league = await prisma.league.create({
    data: {
      name,
      slug,
      ownerUserId: user.id,
    },
  });

  await prisma.leagueMember.create({
    data: {
      leagueId: league.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  await prisma.leagueState.create({
    data: {
      id: `state_${league.id}`,
      leagueId: league.id,
      season: 0,
      seasonLock: false,
      phase: "PRE_SEASON",
    },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      type: "LEAGUE_CREATED",
      summary: `League created: ${league.name}`,
      entityType: "LEAGUE",
      entityId: league.id,
      meta: JSON.stringify({ slug: league.slug, ownerUserId: user.id }),
    },
  });

  return NextResponse.json(league);
}
