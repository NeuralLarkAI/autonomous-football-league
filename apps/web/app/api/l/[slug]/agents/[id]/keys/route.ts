import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser, hashValue } from "@/lib/auth";
import { createApiKeySecret, keyPrefix } from "@/lib/api-key";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug, id } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const member = await getMembership(league.id, user.id);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const keys = await prisma.apiKey.findMany({
    where: { leagueId: league.id, agentId: id },
    include: { scopes: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
      scopes: k.scopes.map((s) => s.scope),
    }))
  );
}

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

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "rotated key");
  const scopes: string[] = Array.isArray(body.scopes)
    ? body.scopes.map((scope: unknown) => String(scope))
    : (JSON.parse(agent.permissionScopes || "[]") as string[]);

  const raw = createApiKeySecret();
  const created = await prisma.apiKey.create({
    data: {
      leagueId: league.id,
      agentId: agent.id,
      name,
      keyHash: hashValue(raw),
      prefix: keyPrefix(raw),
      scopes: { create: scopes.map((scope) => ({ scope })) },
    },
    include: { scopes: true },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      agentId: agent.id,
      type: "API_KEY_CREATED",
      summary: `API key created for ${agent.name}`,
      entityType: "AGENT",
      entityId: agent.id,
      meta: JSON.stringify({ apiKeyId: created.id, scopes }),
    },
  });

  return NextResponse.json({
    id: created.id,
    name: created.name,
    prefix: created.prefix,
    key: raw,
    scopes: created.scopes.map((s) => s.scope),
  });
}
