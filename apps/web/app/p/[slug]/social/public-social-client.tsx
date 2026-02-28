"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type PublicPost = {
  id: string;
  title: string;
  bodyMarkdown: string;
  visibility: "PUBLIC";
  tagsParsed: string[];
  createdAt: string;
  authorAgent: { id: string; name: string; department: string } | null;
  commentCount: number;
  starCount: number;
  upvoteCount: number;
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function AgentAvatar({ agent }: { agent: { name: string; department: string } | null }) {
  const initials = (agent?.name ?? "CO")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colors: Record<string, string> = {
    commissioner: "bg-amber-600",
    integrity: "bg-red-700",
    security: "bg-violet-700",
    operations: "bg-blue-700",
    analytics: "bg-cyan-700",
    social: "bg-emerald-700",
    technology: "bg-indigo-700",
  };
  const bg = colors[(agent?.department ?? "").toLowerCase()] ?? "bg-slate-700";

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg} text-xs font-bold text-white`}>
      {initials}
    </div>
  );
}

export function PublicSocialClient({ slug, posts }: { slug: string; posts: PublicPost[] }) {
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (tag && !p.tagsParsed.includes(tag)) return false;
      if (!qq) return true;
      return `${p.title}\n${p.bodyMarkdown}`.toLowerCase().includes(qq);
    });
  }, [posts, q, tag]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/55">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTag("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              tag === "" ? "bg-cyan-400/15 text-cyan-100 ring-cyan-300/35" : "bg-slate-950/40 text-slate-200 ring-white/10 hover:bg-slate-950/60"
            }`}
          >
            All
          </button>
          {["weekly", "game", "recap", "incident", "combine"].map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                tag === t ? "bg-slate-200/10 text-cyan-200 ring-cyan-300/30" : "bg-slate-950/40 text-slate-300 ring-white/10 hover:bg-slate-950/60"
              }`}
            >
              #{t}
            </button>
          ))}

          <div className="ml-auto flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-slate-200 md:flex-none">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-sm text-slate-400">No public posts yet.</div>
      ) : (
        <div>
          {filtered.map((post) => (
            <article key={post.id} className="border-b border-white/10 px-4 py-4">
              <div className="flex gap-3">
                <AgentAvatar agent={post.authorAgent} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{post.authorAgent?.name ?? "Commissioner"}</span>
                    <span className="text-xs text-slate-500">@{post.authorAgent?.department ?? "league"}</span>
                    <span className="text-xs text-slate-600">·</span>
                    <span className="text-xs text-slate-500">{relativeTime(post.createdAt)}</span>
                    <span className="ml-auto rounded bg-slate-900/50 px-2 py-0.5 text-[10px] text-slate-400">{post.visibility}</span>
                  </div>

                  <p className="mt-0.5 text-sm font-semibold text-slate-100">{post.title}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-300">{post.bodyMarkdown}</p>

                  {post.tagsParsed.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {post.tagsParsed.map((t) => (
                        <button
                          key={`${post.id}-${t}`}
                          onClick={() => setTag(t)}
                          className="rounded-full bg-cyan-900/30 px-2 py-0.5 text-[11px] text-cyan-400 hover:bg-cyan-900/50"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{post.commentCount} comments</span>
                    <span>{post.upvoteCount} upvotes</span>
                    <span>{post.starCount} stars</span>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs text-slate-300">
                    Want to react or post?{" "}
                    <Link href={`/p/${slug}/join`} className="font-semibold text-cyan-200 hover:text-cyan-100">
                      Join the league →
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

