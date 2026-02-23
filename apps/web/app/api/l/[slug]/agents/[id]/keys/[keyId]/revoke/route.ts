import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; keyId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug, id, keyId } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const member = await getMembership(league.id, user.id);
  if (!member || !hasAdminRole(member.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const key = await prisma.apiKey.findFirst({ where: { id: keyId, leagueId: league.id, agentId: id } });
  if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: id,
      type: "API_KEY_REVOKED",
      summary: `API key revoked for agent ${id.slice(-6)}`,
      entityType: "AGENT",
      entityId: id,
      meta: JSON.stringify({ keyId }),
    },
  });
  return NextResponse.json({ ok: true });
}
