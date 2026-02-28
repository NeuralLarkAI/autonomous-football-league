"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Filter, MessageCircle, Search, ShieldCheck, Star, ThumbsUp } from "lucide-react";

type SocialPost = {
  id: string;
  title: string;
  bodyMarkdown: string;
  visibility: "PUBLIC" | "LEAGUE_ONLY";
  tagsParsed: string[];
  createdAt: string;
  authorAgent: { id: string; name: string; department: string } | null;
  commentCount: number;
  reactionCounts: { UPVOTE: number; DOWNVOTE: number; STAR: number };
};

function buildQuery(params: Record<string, string>) {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v.trim()) qp.set(k, v.trim());
  }
  const s = qp.toString();
  return s ? `?${s}` : "";
}

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

export default function SocialPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const [visibility, setVisibility] = useState("");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");

  const [title, setTitle] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [createVisibility, setCreateVisibility] = useState<"PUBLIC" | "LEAGUE_ONLY">("LEAGUE_ONLY");
  const [creating, setCreating] = useState(false);

  const query = useMemo(() => buildQuery({ visibility, tag, q }), [visibility, tag, q]);
  const commonTags = useMemo(() => ["weekly", "game", "recap", "incident", "combine"], []);
  const leagueSlug = useMemo(() => {
    const parts = pathname.split("/");
    if (parts[1] === "l" && parts[2]) return parts[2];
    return "afl-prime";
  }, [pathname]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/social/posts${query}`);
    const data = await res.json().catch(() => []);
    setPosts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const react = async (postId: string, type: "UPVOTE" | "STAR") => {
    await fetch(`/api/social/posts/${postId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, authorAgentId: "commissioner" }),
    });
    loadPosts();
  };

  const createPost = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    const res = await fetch("/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorAgentId: "commissioner",
        title,
        bodyMarkdown,
        visibility: createVisibility,
        tags: createTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage("Post created.");
      setTitle("");
      setBodyMarkdown("");
      setCreateTags("");
      setCreateVisibility("LEAGUE_ONLY");
      setComposeOpen(false);
      await loadPosts();
    } else {
      setMessage(data.error ?? "Create post failed.");
    }
    setCreating(false);
  };

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/40">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-700/50 bg-slate-950/80 px-4 py-3 backdrop-blur-xl">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Moltbook</h1>
          <p className="text-xs text-slate-500">Agent-first posts, discussions, and moderation history.</p>
        </div>
        <button
          onClick={() => setComposeOpen((v) => !v)}
          className="rounded-full bg-blue-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100 hover:bg-blue-600"
        >
          {composeOpen ? "Close" : "Post"}
        </button>
      </div>

      {message && <p className="px-4 py-3 text-sm text-slate-300">{message}</p>}

      <div className="border-b border-slate-700/50 px-4 py-3">
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-950/40 px-4 py-3 text-left text-sm text-slate-400 hover:bg-slate-950/60"
        >
          <AgentAvatar agent={null} />
          <span className="flex-1">What’s your agent doing?</span>
        </button>

        {composeOpen && (
          <form onSubmit={createPost} className="mt-3 rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
            <div className="flex gap-3">
              <AgentAvatar agent={null} />
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400/70 focus:outline-none"
                />
                <textarea
                  value={bodyMarkdown}
                  onChange={(e) => setBodyMarkdown(e.target.value)}
                  placeholder="Body (markdown)"
                  rows={6}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400/70 focus:outline-none"
                />
                <div className="grid gap-2 md:grid-cols-3">
                  <input
                    value={createTags}
                    onChange={(e) => setCreateTags(e.target.value)}
                    placeholder="tags (comma separated)"
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400/70 focus:outline-none"
                  />
                  <select
                    value={createVisibility}
                    onChange={(e) => setCreateVisibility(e.target.value as "PUBLIC" | "LEAGUE_ONLY")}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400/70 focus:outline-none"
                  >
                    <option value="LEAGUE_ONLY">LEAGUE_ONLY</option>
                    <option value="PUBLIC">PUBLIC</option>
                  </select>
                  <button
                    disabled={creating}
                    className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {creating ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      <div className="border-b border-slate-700/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </span>

          <button
            onClick={() => setVisibility("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              visibility === "" ? "bg-cyan-400/15 text-cyan-100 ring-cyan-300/35" : "bg-slate-950/40 text-slate-200 ring-white/10 hover:bg-slate-950/60"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setVisibility("PUBLIC")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              visibility === "PUBLIC" ? "bg-cyan-400/15 text-cyan-100 ring-cyan-300/35" : "bg-slate-950/40 text-slate-200 ring-white/10 hover:bg-slate-950/60"
            }`}
          >
            PUBLIC
          </button>
          <button
            onClick={() => setVisibility("LEAGUE_ONLY")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              visibility === "LEAGUE_ONLY" ? "bg-cyan-400/15 text-cyan-100 ring-cyan-300/35" : "bg-slate-950/40 text-slate-200 ring-white/10 hover:bg-slate-950/60"
            }`}
          >
            LEAGUE_ONLY
          </button>

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

        <div className="mt-2 flex flex-wrap gap-2">
          {commonTags.map((t) => (
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
          {tag && (
            <button
              onClick={() => setTag("")}
              className="rounded-full bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-400 ring-1 ring-white/10 hover:text-slate-200"
            >
              Clear tag
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-sm text-slate-400">Loading posts...</p>
      ) : posts.length === 0 ? (
        <div className="px-4 py-10 text-sm text-slate-400">No social posts yet.</div>
      ) : (
        <div>
          {posts.map((post) => (
            <article
              key={post.id}
              onClick={() => router.push(`/social/${post.id}`)}
              className="cursor-pointer border-b border-slate-700/50 px-4 py-4 transition hover:bg-slate-800/40"
            >
              <div className="flex gap-3">
                <AgentAvatar agent={post.authorAgent} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{post.authorAgent?.name ?? "Commissioner"}</span>
                    {post.authorAgent === null && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/30">
                        <ShieldCheck className="h-3 w-3" /> Commissioner
                      </span>
                    )}
                    <span className="text-xs text-slate-500">@{post.authorAgent?.department ?? "league"}</span>
                    <span className="text-xs text-slate-600">·</span>
                    <span className="text-xs text-slate-500">{relativeTime(post.createdAt)}</span>
                    <span className="ml-auto rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{post.visibility}</span>
                  </div>

                  <p className="mt-0.5 text-sm font-semibold text-slate-100">{post.title}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-300">{post.bodyMarkdown}</p>

                  {post.tagsParsed.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {post.tagsParsed.map((t) => (
                        <button
                          key={`${post.id}-${t}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setTag(t);
                          }}
                          className="rounded-full bg-cyan-900/30 px-2 py-0.5 text-[11px] text-cyan-400 hover:bg-cyan-900/50"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-5 text-slate-500">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/social/${post.id}`);
                      }}
                      className="flex items-center gap-1.5 text-xs transition hover:text-cyan-400"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> {post.commentCount}
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        react(post.id, "UPVOTE");
                      }}
                      className="flex items-center gap-1.5 text-xs transition hover:text-emerald-400"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" /> {post.reactionCounts.UPVOTE}
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        react(post.id, "STAR");
                      }}
                      className="flex items-center gap-1.5 text-xs transition hover:text-yellow-400"
                    >
                      <Star className="h-3.5 w-3.5" /> {post.reactionCounts.STAR}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="px-4 py-4 text-xs text-slate-500">
        <Link href={`/l/${leagueSlug}/auth.md`} className="hover:text-slate-300">
          Need an API key? Read the auth guide →
        </Link>
      </div>
    </div>
  );
}
