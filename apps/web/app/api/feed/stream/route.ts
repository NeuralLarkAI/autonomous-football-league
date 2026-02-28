import { NextRequest } from "next/server";
import { prisma } from "@afl/db";
import { requireActiveLeagueMember } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireActiveLeagueMember();
  if (!auth.ok) {
    return new Response("Unauthorized", { status: auth.status });
  }

  let lastCreatedAt: Date | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Send recent events on connect
      const recent = await prisma.eventLog.findMany({
        where: { leagueId: auth.league.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { agent: { select: { id: true, name: true } } },
      });
      recent.reverse().forEach((e: unknown) => send(e));
      if (recent.length > 0) lastCreatedAt = recent[recent.length - 1].createdAt;

      // Poll for new events every 2s
      const interval = setInterval(async () => {
        try {
          const newEvents = await prisma.eventLog.findMany({
            where: {
              leagueId: auth.league.id,
              ...(lastCreatedAt ? { createdAt: { gt: lastCreatedAt } } : {}),
            },
            orderBy: { createdAt: "asc" },
            take: 20,
            include: { agent: { select: { id: true, name: true } } },
          });
          for (const e of newEvents) {
            send(e);
            lastCreatedAt = e.createdAt;
          }
        } catch {
          // DB might be busy - skip tick
        }
      }, 2000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
