import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RejectSchema } from "@afl/core";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

const EXTERNAL_REG_MARKER = "AFL_EXTERNAL_AGENT_REGISTRATION";

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
    const parsed = RejectSchema.safeParse(body);
    const reason = parsed.success ? (parsed.data.reason ?? "No reason given") : "No reason given";

    const existing = await prisma.approval.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    if (existing.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Approval is not pending" }, { status: 409 });
    }

    const approval = await prisma.approval.update({
      where: { id },
      data: { status: "REJECTED" },
      include: { agent: true },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: existing.leagueId,
        agentId: approval.agentId,
        type: "REJECTED",
        summary: `Approval #${id.slice(-6)} REJECTED - ${approval.summary}. Reason: ${reason}`,
        meta: JSON.stringify({ approvalId: id, tier: approval.tier, reason }),
      },
    });

    // External agent registration approvals: flip registration to REJECTED so claim cannot proceed.
    let rejectedClaimCode: string | null = null;
    if (approval.taskId) {
      const task = await prisma.task.findUnique({
        where: { id: approval.taskId },
        select: { id: true, leagueId: true, title: true, description: true },
      });
      if (task?.description && task.description.includes(EXTERNAL_REG_MARKER)) {
        // cuid() ids are lowercase alnum; keep parsing simple and robust.
        const m = task.description.match(/registrationId=([a-z0-9]+)/i);
        const registrationId = m?.[1];
        const claimMatch = task.description.match(/claimCode=([A-Z0-9-]+)/i);
        rejectedClaimCode = claimMatch?.[1]?.toUpperCase() ?? null;
        if (registrationId) {
          const updated = await prisma.agentRegistration.updateMany({
            where: { id: registrationId, status: "PENDING" },
            data: { status: "REJECTED" },
          });
          if (updated.count > 0) {
            await prisma.eventLog.create({
              data: {
                leagueId: task.leagueId,
                agentId: "commissioner",
                type: "AGENT_REGISTRATION_REJECTED",
                summary: `External agent registration rejected: ${task.title}. Reason: ${reason}`,
                entityType: "AGENT",
                entityId: registrationId,
                visibility: "LEAGUE_ONLY",
                meta: JSON.stringify({ marker: EXTERNAL_REG_MARKER, registrationId, approvalId: id, taskId: task.id, reason }),
              },
            });
          }
        }
      }
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
      const claimUrl = rejectedClaimCode ? `${baseUrl}/claim/${encodeURIComponent(rejectedClaimCode)}` : null;
      const content = claimUrl
        ? `❌ **${approval.summary}** has been rejected. Reason: ${reason}. Claim: ${claimUrl}`
        : `❌ **${approval.summary}** has been rejected. Reason: ${reason}.`;
      void fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).catch(() => {});
    }

    return NextResponse.json(approval);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Reject failed" }, { status: 500 });
  }
}
