import { NextResponse } from "next/server";
import { runKickoff } from "@afl/agents";
import { getActiveLeague } from "@/lib/request-league";

export async function POST() {
  try {
    const activeLeague = await getActiveLeague();
    const result = await runKickoff(activeLeague.id);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Kickoff failed" }, { status: 500 });
  }
}
