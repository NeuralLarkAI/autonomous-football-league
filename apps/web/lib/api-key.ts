import { NextRequest } from "next/server";
import { prisma } from "@afl/db";
import { hashValue } from "@/lib/auth";

export type ApiKeyPrincipal = {
  apiKeyId: string;
  leagueId: string;
  agentId: string | null;
  userId: string | null;
  scopes: string[];
};

export function createApiKeySecret() {
  const raw = `afl_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  return raw;
}

export function keyPrefix(raw: string) {
  return raw.slice(0, 8);
}

export async function resolveApiKey(req: NextRequest): Promise<ApiKeyPrincipal | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const raw = auth.slice("Bearer ".length).trim();
  if (!raw) return null;
  const keyHash = hashValue(raw);
  const key = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    include: { scopes: true },
  });
  if (!key) return null;
  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return {
    apiKeyId: key.id,
    leagueId: key.leagueId,
    agentId: key.agentId ?? null,
    userId: key.userId ?? null,
    scopes: key.scopes.map((s) => s.scope),
  };
}

export async function enforceScope(opts: {
  req: NextRequest;
  leagueId: string;
  requiredScope: string;
  denySummary: string;
}) {
  const principal = await resolveApiKey(opts.req);
  const denied = async (reason: string) => {
    await prisma.eventLog.create({
      data: {
        leagueId: opts.leagueId,
        agentId: principal?.agentId ?? undefined,
        type: "AUTHZ_DENIED",
        summary: opts.denySummary,
        entityType: "AGENT",
        entityId: principal?.agentId ?? undefined,
        meta: JSON.stringify({
          reason,
          requiredScope: opts.requiredScope,
          principalApiKeyId: principal?.apiKeyId ?? null,
          principalLeagueId: principal?.leagueId ?? null,
        }),
      },
    });
  };

  if (!principal) {
    await denied("MISSING_OR_INVALID_API_KEY");
    return { ok: false as const, status: 401, error: "Invalid API key" };
  }
  if (principal.leagueId !== opts.leagueId) {
    await denied("LEAGUE_MISMATCH");
    return { ok: false as const, status: 403, error: "League mismatch" };
  }
  if (!principal.scopes.includes(opts.requiredScope)) {
    await denied("MISSING_SCOPE");
    return { ok: false as const, status: 403, error: "Missing required scope" };
  }
  return { ok: true as const, principal };
}
