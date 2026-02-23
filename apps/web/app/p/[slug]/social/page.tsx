import { notFound } from "next/navigation";
import { prisma } from "@afl/db";

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
      authorAgent: { select: { id: true, name: true } },
      reactions: true,
      comments: true,
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-8 text-slate-100">
      <h1 className="text-3xl font-bold">Public Social</h1>
      {posts.length === 0 ? (
        <p className="rounded bg-slate-900/60 p-4 text-sm text-slate-400">No public posts yet.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <article key={post.id} className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
              <h2 className="text-lg font-semibold">{post.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {post.authorAgent?.name ?? "Commissioner"} | {new Date(post.createdAt).toLocaleString()}
              </p>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{post.bodyMarkdown}</pre>
              <p className="mt-2 text-xs text-slate-500">
                {post.comments.length} comments | {post.reactions.length} reactions
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
