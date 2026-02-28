import { NextRequest, NextResponse } from "next/server";
import { getActiveLeague } from "@/lib/request-league";
import { runSeasonZeroKickoffAgents } from "@/lib/season0-kickoff-agents";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function POST(req: NextRequest) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const activeLeague = await getActiveLeague();
    const result = await runSeasonZeroKickoffAgents(activeLeague.id);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Kickoff failed" }, { status: 500 });
  }
}
