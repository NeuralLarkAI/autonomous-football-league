import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateIncidentSchema } from "@afl/core";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const incidents = await prisma.incident.findMany({
      where: { leagueId: auth.league.id, status: status ?? undefined },
      include: { sourceAgent: { select: { id: true, name: true, department: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(incidents);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json();
    const parsed = CreateIncidentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const incident = await prisma.incident.create({
      data: { ...parsed.data, leagueId: auth.league.id },
      include: { sourceAgent: { select: { id: true, name: true, department: true } } },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: auth.league.id,
        agentId: incident.sourceAgentId ?? undefined,
        type: "INCIDENT_CREATED",
        summary: `Incident created: ${incident.title}`,
        entityType: "INCIDENT",
        entityId: incident.id,
        incidentId: incident.id,
        meta: JSON.stringify({ severity: incident.severity, status: incident.status }),
      },
    });

    return NextResponse.json(incident);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
