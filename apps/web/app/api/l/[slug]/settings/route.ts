import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateLeagueSettingsSchema } from "@afl/core";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const member = await getMembership(league.id, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const settings = await prisma.leagueSettings.findUnique({ where: { leagueId: league.id } });
  return NextResponse.json(settings ?? { leagueId: league.id, isPublic: false, publicName: league.name, description: "" });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const member = await getMembership(league.id, user.id);
  if (!member || !hasAdminRole(member.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = CreateLeagueSettingsSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const settings = await prisma.leagueSettings.upsert({
    where: { leagueId: league.id },
    update: {
      isPublic: parsed.data.isPublic,
      publicName: parsed.data.publicName,
      description: parsed.data.description,
    },
    create: {
      leagueId: league.id,
      isPublic: parsed.data.isPublic ?? false,
      publicName: parsed.data.publicName ?? league.name,
      description: parsed.data.description ?? "",
    },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      type: "LEAGUE_SETTINGS_UPDATED",
      summary: `League public settings updated (isPublic=${settings.isPublic})`,
      entityType: "LEAGUE",
      entityId: league.id,
      meta: JSON.stringify({ isPublic: settings.isPublic, publicName: settings.publicName }),
    },
  });
  return NextResponse.json(settings);
}
