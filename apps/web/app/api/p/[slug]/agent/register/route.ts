import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@afl/db";
import { randomToken } from "@/lib/auth";
import { enforceIpRateLimit } from "@/lib/ip-rate-limit";

const EXTERNAL_REG_MARKER = "AFL_EXTERNAL_AGENT_REGISTRATION";

function claimCode(): string {
  const a = crypto.randomBytes(3).toString("hex").toUpperCase();
  const b = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AFL-${a}-${b}`;
}

const DEFAULT_SCOPES = [
  "agent:self:read",
  "agent:self:run",
  "social:read",
  "social:write",
  "feed:read",
  "combine:run",
] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const rl = enforceIpRateLimit(req, { key: "public_agent_register", limit: 20, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    const { slug } = await params;
    const league = await prisma.league.findUnique({
      where: { slug },
      include: { settings: true },
    });
    if (!league || !league.settings?.isPublic) {
      return NextResponse.json({ error: "Public league not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const agentName = String(body.agentName ?? "").trim();
    const walletAddressRaw = body.walletAddress ? String(body.walletAddress).trim() : "";
    const walletAddress = walletAddressRaw ? walletAddressRaw : null;
    const description = String(body.description ?? "").trim();
    const mode = body.mode === "SANDBOX" ? "SANDBOX" : "EXTERNAL";
    const requestedScopesInput: unknown[] = Array.isArray(body.requestedScopes) ? body.requestedScopes : [];
    const requestedScopes = (requestedScopesInput.length ? requestedScopesInput : [...DEFAULT_SCOPES])
      .map((s: unknown) => String(s).trim())
      .filter(Boolean)
      .slice(0, 24);

    if (!agentName || agentName.length < 3) {
      return NextResponse.json({ error: "Agent name must be at least 3 characters." }, { status: 400 });
    }
    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format." }, { status: 400 });
    }

    let code = claimCode();
    for (let i = 0; i < 4; i += 1) {
      const existing = await prisma.agentRegistration.findUnique({ where: { claimCode: code } });
      if (!existing) break;
      code = claimCode();
    }

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2);
    const result = await prisma.$transaction(async (tx) => {
      const registration = await tx.agentRegistration.create({
        data: {
          leagueId: league.id,
          agentName,
          walletAddress: walletAddress ?? undefined,
          description,
          requestedScopes: JSON.stringify(requestedScopes),
          mode,
          status: "PENDING", // Awaiting commissioner approval
          registrationToken: randomToken(20),
          claimCode: code,
          expiresAt,
        },
      });

      // Create a real approval item so the commissioner queue shows the registration.
      const task = await tx.task.create({
        data: {
          leagueId: league.id,
          title: `External Agent Registration: ${agentName}`,
          description: [
            `${EXTERNAL_REG_MARKER} registrationId=${registration.id} claimCode=${registration.claimCode}`,
            "",
            `Mode: ${mode}`,
            `Wallet: ${walletAddress ?? "(none)"}`,
            `Requested scopes: ${requestedScopes.join(", ")}`,
            "",
            `Agent description:`,
            description || "(none)",
          ].join("\n"),
          status: "REVIEW",
          tier: 1,
          department: "COMMISSIONER",
          acceptanceCriteria:
            "Approve if the request looks legitimate and scopes are reasonable. Reject if suspicious or abusive.",
          riskNotes:
            "Approving grants an API key with the requested scopes. Review scopes and registration details carefully.",
        },
      });

      const approval = await tx.approval.create({
        data: {
          leagueId: league.id,
          taskId: task.id,
          agentId: "commissioner",
          tier: 1,
          summary: `Review external agent registration: ${agentName} (${mode})`,
          status: "PENDING",
        },
      });

      await tx.eventLog.create({
        data: {
          leagueId: league.id,
          agentId: "commissioner",
          type: "AGENT_REGISTERED",
          tier: 1,
          summary: `Public registration submitted: ${agentName}`,
          // Link the feed entry directly to the approval so clicks work.
          entityType: "APPROVAL",
          entityId: approval.id,
          taskId: task.id,
          approvalId: approval.id,
          visibility: "LEAGUE_ONLY",
          meta: JSON.stringify({
            marker: EXTERNAL_REG_MARKER,
            registrationId: registration.id,
            claimCode: registration.claimCode,
            mode,
            walletAddress,
            requestedScopes,
            approvalId: approval.id,
            taskId: task.id,
          }),
        },
      });

      return { registration, approval };
    });

    return NextResponse.json({
      registrationId: result.registration.id,
      approvalId: result.approval.id,
      claimCode: result.registration.claimCode,
      claimUrl: `/claim/${result.registration.claimCode}`,
      expiresAt: result.registration.expiresAt,
      nextStep:
        "Commissioner review is required. After approval, you can complete claim verification and receive your API key.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Public registration failed" }, { status: 500 });
  }
}
