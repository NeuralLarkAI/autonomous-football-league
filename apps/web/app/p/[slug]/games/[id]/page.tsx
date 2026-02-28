import { notFound } from "next/navigation";
import { prisma } from "@afl/db";
import { AispnGamecast } from "@/components/aispn-gamecast";

export default async function PublicGameDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
  if (!league || !league.settings?.isPublic) return notFound();

  const game = await prisma.game.findFirst({
    where: { id, leagueId: league.id },
    select: { id: true },
  });
  if (!game) return notFound();

  return (
    <AispnGamecast slug={slug} gameId={id} />
  );
}
