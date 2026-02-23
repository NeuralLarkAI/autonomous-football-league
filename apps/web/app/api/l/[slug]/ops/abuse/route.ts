import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
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

  const abuseEvents = await prisma.abuseEvent.findMany({
    where: { leagueId: league.id },
    include: {
      agent: { select: { id: true, name: true } },
      apiKey: { select: { id: true, name: true, prefix: true, revokedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(abuseEvents);
}

export async function POST(
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

  const body = await req.json().catch(() => ({}));
  const apiKeyId = String(body.apiKeyId ?? "");
  if (!apiKeyId) return NextResponse.json({ error: "apiKeyId required" }, { status: 400 });

  const apiKey = await prisma.apiKey.findFirst({ where: { id: apiKeyId, leagueId: league.id } });
  if (!apiKey) return NextResponse.json({ error: "API key not found" }, { status: 404 });
  if (!apiKey.revokedAt) {
    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { revokedAt: new Date() } });
  }

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: apiKey.agentId ?? undefined,
      type: "API_KEY_REVOKED",
      summary: `API key revoked from abuse panel (${apiKey.prefix}...)`,
      entityType: "AGENT",
      entityId: apiKey.agentId ?? undefined,
      meta: JSON.stringify({ apiKeyId: apiKey.id, revokedByUserId: user.id }),
    },
  });

  return NextResponse.json({ ok: true });
}
