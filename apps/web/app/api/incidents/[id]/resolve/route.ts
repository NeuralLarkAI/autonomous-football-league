import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { ResolveIncidentSchema } from "@afl/core";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = ResolveIncidentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const existing = await prisma.incident.findUnique({ where: { id }, select: { leagueId: true, title: true } });
    if (!existing) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    if (existing.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const incident = await prisma.incident.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: incident.leagueId,
        type: "INCIDENT_RESOLVED",
        summary: `Incident resolved: ${incident.title}`,
        entityType: "INCIDENT",
        entityId: incident.id,
        incidentId: incident.id,
        meta: JSON.stringify({ note: parsed.data.resolutionNote ?? "" }),
      },
    });

    return NextResponse.json(incident);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Resolve failed" }, { status: 500 });
  }
}
