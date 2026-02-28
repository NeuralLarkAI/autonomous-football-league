import { NextRequest } from "next/server";
import { prisma } from "@afl/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
  if (!league || !league.settings?.isPublic) return new Response("Not found", { status: 404 });

  const game = await prisma.game.findFirst({ where: { id, leagueId: league.id }, select: { id: true, leagueId: true } });
  if (!game) return new Response("Game not found", { status: 404 });

  const encoder = new TextEncoder();
  let lastEventTime = new Date(0);
  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ gameId: id })}\n\n`));

      const poll = async () => {
        try {
          const events = await prisma.eventLog.findMany({
            where: {
              leagueId: league.id,
              gameId: id,
              visibility: "PUBLIC",
              createdAt: { gt: lastEventTime },
            },
            orderBy: { createdAt: "asc" },
          });

          for (const ev of events) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
            lastEventTime = ev.createdAt;
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`
            )
          );
        }
      };

      await poll();
      interval = setInterval(poll, 1500);
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

