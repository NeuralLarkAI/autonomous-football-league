import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser, hashValue } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";

export async function POST(
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

  const agent = await prisma.agent.findFirst({ where: { id, leagueId: league.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (!agent.externalEndpointUrl) return NextResponse.json({ error: "Agent has no external endpoint configured" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const secret = String(body.secret ?? "");
  if (!secret || hashValue(secret) !== (agent.externalSharedSecretHash ?? "")) {
    await prisma.eventLog.create({
      data: {
        leagueId: league.id,
        agentId: agent.id,
        type: "AUTHZ_DENIED",
        summary: `External test denied for ${agent.name}`,
        entityType: "AGENT",
        entityId: agent.id,
        meta: JSON.stringify({ reason: "SECRET_MISMATCH" }),
      },
    });
    return NextResponse.json({ error: "Secret mismatch" }, { status: 403 });
  }

  const payload = {
    type: "AFL_EXTERNAL_TEST",
    leagueSlug: slug,
    agentId: agent.id,
    timestamp: new Date().toISOString(),
  };

  let status = 0;
  let responseBody = "";
  try {
    const response = await fetch(agent.externalEndpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AFL-SECRET": secret,
      },
      body: JSON.stringify(payload),
    });
    status = response.status;
    responseBody = await response.text();
  } catch (e) {
    responseBody = e instanceof Error ? e.message : String(e);
  }

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: agent.id,
      type: "EXTERNAL_AGENT_TESTED",
      summary: `External test completed for ${agent.name}`,
      entityType: "AGENT",
      entityId: agent.id,
      meta: JSON.stringify({ endpoint: agent.externalEndpointUrl, status, responseBody: responseBody.slice(0, 500) }),
    },
  });

  await prisma.message.create({
    data: {
      leagueId: league.id,
      agentId: agent.id,
      type: "ALERT",
      title: "External Agent Test Response",
      body: responseBody.slice(0, 2000),
      meta: JSON.stringify({ status, endpoint: agent.externalEndpointUrl }),
    },
  });

  return NextResponse.json({ ok: status >= 200 && status < 300, status, responseBody });
}
