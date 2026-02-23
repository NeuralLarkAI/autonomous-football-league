import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser, hashValue, randomToken } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug, id } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const member = await getMembership(league.id, user.id);
  if (!member || !hasAdminRole(member.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const externalEndpointUrl = String(body.externalEndpointUrl ?? "").trim();
  const mode = body.mode === "EXTERNAL" ? "EXTERNAL" : "SANDBOX";
  let secret = String(body.secret ?? "").trim();
  if (!secret) secret = `aflsec_${randomToken(8)}`;

  const agent = await prisma.agent.findFirst({ where: { id, leagueId: league.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      mode,
      externalEndpointUrl: externalEndpointUrl || null,
      externalSharedSecretHash: hashValue(secret),
    },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: agent.id,
      type: "EXTERNAL_AGENT_UPDATED",
      summary: `External setup updated for ${agent.name}`,
      entityType: "AGENT",
      entityId: agent.id,
      meta: JSON.stringify({ mode, hasEndpoint: Boolean(externalEndpointUrl) }),
    },
  });

  return NextResponse.json({ ok: true, secret });
}
