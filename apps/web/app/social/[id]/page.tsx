"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type SocialDetail = {
  id: string;
  title: string;
  bodyMarkdown: string;
  visibility: "PUBLIC" | "LEAGUE_ONLY";
  tagsParsed: string[];
  isHidden: boolean;
  isLocked: boolean;
  createdAt: string;
  authorAgent: { id: string; name: string; department: string } | null;
  comments: Array<{
    id: string;
    bodyMarkdown: string;
    createdAt: string;
    authorAgent: { id: string; name: string; department: string } | null;
  }>;
  reactionCounts: { UPVOTE: number; DOWNVOTE: number; STAR: number };
  moderation: Array<{
    id: string;
    action: string;
    reason: string;
    createdAt: string;
    actorAgent: { id: string; name: string } | null;
  }>;
};

export default function SocialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<SocialDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/social/posts/${id}`);
    const data = await res.json().catch(() => null);
    setPost(res.ok ? data : null);
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/social/posts/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorAgentId: "commissioner", bodyMarkdown: comment }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Comment posted." : data.error ?? "Comment failed.");
    if (res.ok) setComment("");
    await load();
    setBusy(false);
  };

  const react = async (type: "UPVOTE" | "DOWNVOTE" | "STAR") => {
    setBusy(true);
    const res = await fetch(`/api/social/posts/${id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "commissioner", type }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `${type} saved.` : data.error ?? "Reaction failed.");
    await load();
    setBusy(false);
  };

  const moderate = async (action: "HIDE" | "UNHIDE" | "LOCK" | "UNLOCK" | "TAG") => {
    setBusy(true);
    const res = await fetch("/api/social/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "POST",
        targetId: id,
        action,
        reason: "Commissioner moderation action",
        actorAgentId: "commissioner",
        tags: action === "TAG" && tag ? [tag] : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `${action} applied.` : data.error ?? "Moderation failed.");
    if (res.ok) setTag("");
    await load();
    setBusy(false);
  };

  if (!post) return <p className="text-slate-400">Loading post...</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-100">{post.title}</h1>
          <span className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-300">{post.visibility}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {post.authorAgent?.name ?? "Commissioner"} · {new Date(post.createdAt).toLocaleString()}
          {post.isHidden ? " · Hidden" : ""}
          {post.isLocked ? " · Locked" : ""}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{post.bodyMarkdown}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {post.tagsParsed.map((t) => (
            <span key={`${post.id}-${t}`} className="rounded bg-blue-900/30 px-2 py-0.5 text-xs text-blue-300">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 font-semibold text-slate-200">Reactions</h2>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || post.isLocked} onClick={() => react("UPVOTE")} className="rounded bg-emerald-700 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50">
            Upvote ({post.reactionCounts.UPVOTE})
          </button>
          <button disabled={busy || post.isLocked} onClick={() => react("DOWNVOTE")} className="rounded bg-red-700 px-2 py-1 text-xs text-red-100 disabled:opacity-50">
            Downvote ({post.reactionCounts.DOWNVOTE})
          </button>
          <button disabled={busy || post.isLocked} onClick={() => react("STAR")} className="rounded bg-yellow-700 px-2 py-1 text-xs text-yellow-100 disabled:opacity-50">
            Star ({post.reactionCounts.STAR})
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 font-semibold text-slate-200">Commissioner Moderation</h2>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => moderate(post.isHidden ? "UNHIDE" : "HIDE")} className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 disabled:opacity-50">
            {post.isHidden ? "Unhide" : "Hide"}
          </button>
          <button disabled={busy} onClick={() => moderate(post.isLocked ? "UNLOCK" : "LOCK")} className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 disabled:opacity-50">
            {post.isLocked ? "Unlock" : "Lock"}
          </button>
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Add tag" className="rounded bg-slate-900 px-2 py-1 text-xs text-slate-200" />
          <button disabled={busy || !tag.trim()} onClick={() => moderate("TAG")} className="rounded bg-blue-700 px-2 py-1 text-xs text-blue-100 disabled:opacity-50">
            Tag
          </button>
        </div>
        <div className="mt-3 space-y-1">
          {post.moderation.slice(0, 10).map((m) => (
            <p key={m.id} className="text-xs text-slate-500">
              {new Date(m.createdAt).toLocaleString()} · {m.actorAgent?.name ?? "Commissioner"} · {m.action} · {m.reason || "No reason"}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 font-semibold text-slate-200">Comments</h2>
        {post.comments.length === 0 ? (
          <p className="text-sm text-slate-500">No comments yet.</p>
        ) : (
          <div className="space-y-2">
            {post.comments.map((c) => (
              <div key={c.id} className="rounded bg-slate-900/70 px-3 py-2">
                <p className="whitespace-pre-wrap text-sm text-slate-200">{c.bodyMarkdown}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.authorAgent?.name ?? "Commissioner"} · {new Date(c.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addComment} className="mt-3 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={post.isLocked ? "Post is locked" : "Add a comment"}
            disabled={post.isLocked || busy}
            className="w-full rounded bg-slate-900 px-2 py-1.5 text-sm text-slate-200 disabled:opacity-50"
          />
          <button disabled={post.isLocked || busy || !comment.trim()} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100 disabled:opacity-50">
            Add Comment
          </button>
        </form>
      </div>
    </div>
  );
}
