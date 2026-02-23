import { NextRequest } from "next/server";
import { prisma } from "@afl/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let lastId: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Send recent events on connect
      const recent = await prisma.eventLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { agent: { select: { id: true, name: true } } },
      });
      recent.reverse().forEach((e: unknown) => send(e));
      if (recent.length > 0) lastId = recent[recent.length - 1].id;

      // Poll for new events every 2s
      const interval = setInterval(async () => {
        try {
          const newEvents = await prisma.eventLog.findMany({
            where: lastId ? { id: { gt: lastId } } : undefined,
            orderBy: { createdAt: "asc" },
            take: 20,
            include: { agent: { select: { id: true, name: true } } },
          });
          for (const e of newEvents) {
            send(e);
            lastId = e.id;
          }
        } catch {
          // DB might be busy — skip tick
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
