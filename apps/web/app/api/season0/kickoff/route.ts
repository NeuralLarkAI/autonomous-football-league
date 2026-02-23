import { NextResponse } from "next/server";
import { runKickoff } from "@afl/agents";

export async function POST() {
  try {
    const result = await runKickoff();
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Kickoff failed" }, { status: 500 });
  }
}
