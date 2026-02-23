import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateIncidentSchema } from "@afl/core";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const incidents = await prisma.incident.findMany({
      where: { status: status ?? undefined },
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
    const body = await req.json();
    const parsed = CreateIncidentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const incident = await prisma.incident.create({
      data: parsed.data,
      include: { sourceAgent: { select: { id: true, name: true, department: true } } },
    });

    await prisma.eventLog.create({
      data: {
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
