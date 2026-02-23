import { cookies } from "next/headers";
import { prisma } from "@afl/db";
import { DEFAULT_LEAGUE_SLUG } from "@/lib/league";

export async function getActiveLeague() {
  const cookieStore = await cookies();
  const slug = cookieStore.get("league_slug")?.value || DEFAULT_LEAGUE_SLUG;
  const league = await prisma.league.findUnique({ where: { slug } });
  if (league) return league;
  const fallback = await prisma.league.findUnique({ where: { slug: DEFAULT_LEAGUE_SLUG } });
  if (fallback) return fallback;
  const first = await prisma.league.findFirst({ orderBy: { createdAt: "asc" } });
  if (!first) throw new Error("No league found");
  return first;
}
