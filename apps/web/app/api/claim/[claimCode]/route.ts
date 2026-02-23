import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ claimCode: string }> }
) {
  const { claimCode } = await params;
  const registration = await prisma.agentRegistration.findUnique({
    where: { claimCode },
    include: { league: { select: { id: true, name: true, slug: true } } },
  });
  if (!registration) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  return NextResponse.json({
    id: registration.id,
    claimCode: registration.claimCode,
    agentName: registration.agentName,
    description: registration.description,
    requestedScopes: JSON.parse(registration.requestedScopes || "[]"),
    status: registration.status,
    mode: registration.mode,
    expiresAt: registration.expiresAt,
    league: registration.league,
  });
}
