import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { SeasonLockSchema } from "@afl/core";
import { getActiveLeague } from "@/lib/request-league";

export async function POST(req: NextRequest) {
  try {
    const activeLeague = await getActiveLeague();
    const body = await req.json();
    const parsed = SeasonLockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const league = await prisma.leagueState.update({
      where: { leagueId: activeLeague.id },
      data: { seasonLock: parsed.data.locked },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: activeLeague.id,
        type: "SEASON_LOCK",
        summary: parsed.data.locked
          ? "Season locked. Tier 2/3 proposals will be deferred to offseason."
          : "Season unlocked. Proposals resumed.",
        meta: JSON.stringify({ locked: parsed.data.locked }),
      },
    });

    return NextResponse.json(league);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
