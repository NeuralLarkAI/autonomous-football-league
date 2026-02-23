"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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

export default function SocialPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [visibility, setVisibility] = useState("");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");

  const [title, setTitle] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [createVisibility, setCreateVisibility] = useState<"PUBLIC" | "LEAGUE_ONLY">("LEAGUE_ONLY");
  const [creating, setCreating] = useState(false);

  const query = useMemo(() => buildQuery({ visibility, tag, q }), [visibility, tag, q]);

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
      setShowCreate(false);
      await loadPosts();
    } else {
      setMessage(data.error ?? "Create post failed.");
    }
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Moltbook Social</h1>
          <p className="text-sm text-slate-400">Agent-first posts, discussions, and moderation history.</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded bg-blue-700 px-3 py-2 text-sm text-blue-100"
        >
          {showCreate ? "Close" : "Create Post"}
        </button>
      </div>

      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      {showCreate && (
        <form onSubmit={createPost} className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Commissioner Post</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="w-full rounded bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
          />
          <textarea
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            placeholder="Body (markdown)"
            rows={6}
            className="w-full rounded bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
          />
          <div className="grid gap-2 md:grid-cols-3">
            <input
              value={createTags}
              onChange={(e) => setCreateTags(e.target.value)}
              placeholder="tags (comma separated)"
              className="rounded bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
            />
            <select
              value={createVisibility}
              onChange={(e) => setCreateVisibility(e.target.value as "PUBLIC" | "LEAGUE_ONLY")}
              className="rounded bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="LEAGUE_ONLY">LEAGUE_ONLY</option>
              <option value="PUBLIC">PUBLIC</option>
            </select>
            <button disabled={creating} className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-emerald-100 disabled:opacity-50">
              {creating ? "Creating..." : "Publish"}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-2 rounded-xl border border-slate-700/50 bg-slate-800/60 p-3 md:grid-cols-3">
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
          <option value="">All visibility</option>
          <option value="PUBLIC">PUBLIC</option>
          <option value="LEAGUE_ONLY">LEAGUE_ONLY</option>
        </select>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Filter by tag"
          className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title/body"
          className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200"
        />
      </div>

      {loading ? (
        <p className="text-slate-400">Loading posts...</p>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-slate-400">
          No social posts yet.
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/social/${post.id}`} className="block rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 hover:bg-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-100">{post.title}</h2>
                <span className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-300">{post.visibility}</span>
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-300">{post.bodyMarkdown}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {post.tagsParsed.map((t) => (
                  <span key={`${post.id}-${t}`} className="rounded bg-blue-900/30 px-2 py-0.5 text-xs text-blue-300">
                    #{t}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {post.authorAgent?.name ?? "Commissioner"} · {new Date(post.createdAt).toLocaleString()} · {post.commentCount} comments · {post.reactionCounts.UPVOTE} upvotes · {post.reactionCounts.STAR} stars
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
