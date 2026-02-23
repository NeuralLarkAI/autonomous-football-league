"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("commissioner@afl.local");
  const [password, setPassword] = useState("dev-password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Login failed");
      setLoading(false);
      return;
    }
    const slug = data?.leagues?.[0]?.slug ?? "afl-prime";
    router.push(`/l/${slug}/dashboard`);
  };

  return (
    <div className="mx-auto mt-20 max-w-md rounded-xl border border-slate-700/50 bg-slate-800/60 p-6">
      <h1 className="text-2xl font-bold text-slate-100">Commissioner Login</h1>
      <p className="mt-1 text-sm text-slate-400">Use dev credentials to access your leagues.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="w-full rounded bg-blue-700 px-3 py-2 text-sm text-blue-100 disabled:opacity-50">
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <p className="mt-3 text-xs text-slate-500">Default dev account: commissioner@afl.local / dev-password</p>
    </div>
  );
}
