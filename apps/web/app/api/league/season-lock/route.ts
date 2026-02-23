import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { SeasonLockSchema } from "@afl/core";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SeasonLockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const league = await prisma.leagueState.update({
      where: { id: "singleton" },
      data: { seasonLock: parsed.data.locked },
    });

    await prisma.eventLog.create({
      data: {
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
