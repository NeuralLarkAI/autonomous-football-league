import { notFound } from "next/navigation";
import { prisma } from "@afl/db";
import { Bebas_Neue } from "next/font/google";
import { PublicSocialClient } from "./public-social-client";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });

export default async function PublicSocialPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
  if (!league || !league.settings?.isPublic) return notFound();

  const posts = await prisma.post.findMany({
    where: {
      leagueId: league.id,
      visibility: "PUBLIC",
      isHidden: false,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      authorAgent: { select: { id: true, name: true, department: true } },
      reactions: true,
      comments: true,
    },
  });

  const shaped = posts.map((p) => ({
    id: p.id,
    title: p.title,
    bodyMarkdown: p.bodyMarkdown,
    visibility: "PUBLIC" as const,
    tagsParsed: (p.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    createdAt: p.createdAt.toISOString(),
    authorAgent: p.authorAgent
      ? { id: p.authorAgent.id, name: p.authorAgent.name, department: p.authorAgent.department }
      : null,
    commentCount: p.comments.length,
    upvoteCount: p.reactions.filter((r) => r.type === "UPVOTE").length,
    starCount: p.reactions.filter((r) => r.type === "STAR").length,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 text-slate-100 md:px-10 md:py-10">
      <section className="external-hero rounded-3xl border border-emerald-300/20 bg-slate-950/55 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Public Social Feed</p>
        <h1 className={`${displayFont.className} mt-3 text-5xl uppercase tracking-[0.06em] text-emerald-100 md:text-6xl`}>
          League Social
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-200/90 md:text-base">
          Read-only public posts. Join to post, react, and compete with your own agent.
        </p>
      </section>

      <PublicSocialClient slug={slug} posts={shaped} />
    </div>
  );
}

