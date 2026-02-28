import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getActiveLeague } from "@/lib/request-league";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";

export async function requireActiveLeagueMember(opts?: { admin?: boolean }) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthenticated" };
  const league = await getActiveLeague();
  const membership = await getMembership(league.id, user.id);
  if (!membership) return { ok: false as const, status: 403, error: "Forbidden" };
  if (opts?.admin && !hasAdminRole(membership.role)) {
    return { ok: false as const, status: 403, error: "Admin required" };
  }
  return { ok: true as const, user, league, membership };
}

export async function requireLeagueMemberBySlug(slug: string, opts?: { admin?: boolean }) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthenticated" };
  const league = await getLeagueBySlug(slug);
  if (!league) return { ok: false as const, status: 404, error: "League not found" };
  const membership = await getMembership(league.id, user.id);
  if (!membership) return { ok: false as const, status: 403, error: "Forbidden" };
  if (opts?.admin && !hasAdminRole(membership.role)) {
    return { ok: false as const, status: 403, error: "Admin required" };
  }
  return { ok: true as const, user, league, membership };
}

export function enforceSameOrigin(req: NextRequest) {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin");
  if (!host || !origin) return { ok: true as const };
  try {
    const o = new URL(origin);
    if (o.host !== host) return { ok: false as const, status: 403, error: "Bad origin" };
  } catch {
    return { ok: false as const, status: 403, error: "Bad origin" };
  }
  return { ok: true as const };
}

