"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Submission = {
  id: string;
  version: number;
  status: string;
  checksum: string;
  sizeBytes: number;
  createdAt: string;
  artifacts: Array<{ id: string; filePath: string }>;
  validations: Array<{ id: string; ok: boolean; errorsJson: string; warningsJson: string; createdAt: string }>;
  combineRuns: Array<{ id: string; scoreOverall: number; scoreLatency: number; scoreReliability: number; createdAt: string }>;
};

export default function AgentSubmissionsPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/l/${slug}/agents/${id}/submissions`);
    const data = await res.json().catch(() => []);
    setSubmissions(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [slug, id]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setBusyId("upload");
    setMessage(null);
    const res = await fetch(`/api/l/${slug}/agents/${id}/submissions`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Uploaded submission v${data.version}` : data.error ?? "Upload failed");
    setBusyId(null);
    setFile(null);
    await load();
  };

  const callAction = async (submissionId: string, action: "validate" | "run-combine" | "request-ranked" | "approve-ranked") => {
    setBusyId(`${submissionId}:${action}`);
    setMessage(null);
    const body =
      action === "approve-ranked"
        ? { approved: true, signoffAgentIds: ["commissioner", "integrity"], note: "v5 ranked gate approval" }
        : {};
    const res = await fetch(`/api/l/${slug}/submissions/${submissionId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `${action} complete` : data.error ?? `${action} failed`);
    setBusyId(null);
    await load();
  };

  const latestSubmissionId = useMemo(() => submissions[0]?.id ?? null, [submissions]);

  if (loading) return <p className="text-slate-400">Loading submissions...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Agent Submissions</h1>
      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Upload New Submission (.js)</h2>
        <input
          type="file"
          accept=".js"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-2 block text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:text-slate-100"
        />
        <button
          onClick={upload}
          disabled={!file || busyId === "upload"}
          className="mt-3 rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100 disabled:opacity-50"
        >
          {busyId === "upload" ? "Uploading..." : "Upload"}
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-sm text-slate-400">
          No submissions yet.
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => {
            const validation = submission.validations[0];
            const combine = submission.combineRuns[0];
            return (
              <div key={submission.id} className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-200">
                    v{submission.version} - {submission.status}
                  </p>
                  <p className="text-xs text-slate-500">{new Date(submission.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Size {submission.sizeBytes} bytes | checksum {submission.checksum.slice(0, 12)}...
                </p>
                {validation && (
                  <p className={`mt-2 text-xs ${validation.ok ? "text-emerald-300" : "text-rose-300"}`}>
                    Validation: {validation.ok ? "ok" : "invalid"}
                  </p>
                )}
                {combine && (
                  <p className="mt-1 text-xs text-slate-400">
                    Combine: overall {combine.scoreOverall}, reliability {combine.scoreReliability}, latency {combine.scoreLatency}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => callAction(submission.id, "validate")}
                    disabled={busyId === `${submission.id}:validate`}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                  >
                    Validate
                  </button>
                  <button
                    onClick={() => callAction(submission.id, "run-combine")}
                    disabled={busyId === `${submission.id}:run-combine`}
                    className="rounded bg-purple-700 px-2 py-1 text-xs text-purple-100 disabled:opacity-50"
                  >
                    Run Combine Gate
                  </button>
                  <button
                    onClick={() => callAction(submission.id, "request-ranked")}
                    disabled={busyId === `${submission.id}:request-ranked`}
                    className="rounded bg-blue-700 px-2 py-1 text-xs text-blue-100 disabled:opacity-50"
                  >
                    Request Ranked
                  </button>
                  <button
                    onClick={() => callAction(submission.id, "approve-ranked")}
                    disabled={latestSubmissionId !== submission.id || busyId === `${submission.id}:approve-ranked`}
                    className="rounded bg-emerald-700 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50"
                  >
                    Approve Ranked
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
