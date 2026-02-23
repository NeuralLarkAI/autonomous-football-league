import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { ResolveIncidentSchema } from "@afl/core";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = ResolveIncidentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const incident = await prisma.incident.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });

    await prisma.eventLog.create({
      data: {
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
