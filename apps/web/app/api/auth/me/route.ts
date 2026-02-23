import { NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });

  const memberships = await prisma.leagueMember.findMany({
    where: { userId: user.id },
    include: { league: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
    leagues: memberships.map((m) => ({ id: m.league.id, slug: m.league.slug, name: m.league.name, role: m.role })),
  });
}
