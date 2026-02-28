import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { enforceIpRateLimit } from "@/lib/ip-rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ claimCode: string }> }
) {
  const rl = enforceIpRateLimit(req, { key: "claim_lookup", limit: 120, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  const { claimCode } = await params;
  const code = String(claimCode ?? "").trim().toUpperCase();
  if (!code || code.length > 32 || !/^AFL-[A-Z0-9]{4,12}-[A-Z0-9]{4,12}$/.test(code)) {
    return NextResponse.json({ error: "Invalid claim code format" }, { status: 400 });
  }
  const registration = await prisma.agentRegistration.findUnique({
    where: { claimCode: code },
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
