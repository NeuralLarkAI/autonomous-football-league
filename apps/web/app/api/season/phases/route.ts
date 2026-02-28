import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateSeasonPhaseSchema } from "@afl/core";
import { getActiveLeague } from "@/lib/request-league";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function GET() {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const league = await getActiveLeague();
    const phases = await prisma.seasonPhase.findMany({
      where: { leagueId: league.id },
      orderBy: [{ seasonNumber: "asc" }, { startDate: "asc" }],
    });
    return NextResponse.json(phases);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list phases" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const league = await getActiveLeague();
    const body = await req.json();
    const parsed = CreateSeasonPhaseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const phase = await prisma.seasonPhase.create({
      data: {
        leagueId: league.id,
        seasonNumber: parsed.data.seasonNumber,
        name: parsed.data.name,
        description: parsed.data.description,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        status: parsed.data.status,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: league.id,
        type: "SEASON_PHASE_CREATED",
        summary: `Season phase created: ${phase.name}`,
        entityType: "SEASON_PHASE",
        entityId: phase.id,
        seasonPhaseId: phase.id,
        meta: JSON.stringify({ seasonNumber: phase.seasonNumber, status: phase.status }),
      },
    });

    return NextResponse.json(phase);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create phase" }, { status: 500 });
  }
}
