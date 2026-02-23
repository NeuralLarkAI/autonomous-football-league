import { NextResponse } from "next/server";
import { getActiveLeague } from "@/lib/request-league";
import { runSeasonZeroKickoffAgents } from "@/lib/season0-kickoff-agents";

export async function POST() {
  try {
    const activeLeague = await getActiveLeague();
    const result = await runSeasonZeroKickoffAgents(activeLeague.id);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Kickoff failed" }, { status: 500 });
  }
}
