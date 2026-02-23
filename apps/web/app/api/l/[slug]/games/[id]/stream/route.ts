import { NextRequest } from "next/server";
import { prisma } from "@afl/db";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership } from "@/lib/league";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { slug, id } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return new Response("League not found", { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership) return new Response("Forbidden", { status: 403 });
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
              gameId: id,
              createdAt: { gt: lastEventTime },
            },
            orderBy: { createdAt: "asc" },
            include: { agent: { select: { id: true, name: true } } },
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
