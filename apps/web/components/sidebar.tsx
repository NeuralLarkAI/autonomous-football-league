"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bot,
  BookOpen,
  Cable,
  CalendarRange,
  CheckSquare,
  FlaskConical,
  Gamepad2,
  LayoutDashboard,
  Newspaper,
  Radio,
  ShieldCheck,
  Table2,
  Trophy,
} from "lucide-react";

const NAV = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/games", label: "Games", icon: Gamepad2 },
  { path: "/standings", label: "Standings", icon: Table2 },
  { path: "/approvals", label: "Approvals", icon: ShieldCheck },
  { path: "/social", label: "Social", icon: Newspaper },
  { path: "/combine", label: "Combine", icon: FlaskConical },
  { path: "/ranked", label: "Ranked", icon: Trophy },
  { path: "/season", label: "Season", icon: CalendarRange },
  { path: "/runbooks", label: "Runbooks", icon: BookOpen },
  { path: "/connect", label: "Connect", icon: Cable },
  { path: "/incidents", label: "Incidents", icon: AlertTriangle },
  { path: "/ops", label: "Ops", icon: Activity },
  { path: "/feed", label: "Activity Feed", icon: Radio },
] satisfies Array<{ path: string; label: string; icon: LucideIcon }>;

type LeagueItem = { id: string; name: string; slug: string; role: string };

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueItem[]>([]);
  const [switching, setSwitching] = useState(false);

  const leagueSlug = useMemo(() => {
    const parts = pathname.split("/");
    if (parts[1] === "l" && parts[2]) return parts[2];
    return "afl-prime";
  }, [pathname]);

  const base = `/l/${leagueSlug}`;

  useEffect(() => {
    fetch("/api/leagues")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setLeagues(Array.isArray(data) ? data : []))
      .catch(() => setLeagues([]));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const onSwitchLeague = (slug: string) => {
    if (!slug || slug === leagueSlug) return;
    setSwitching(true);
    router.push(`/l/${slug}/dashboard`);
  };

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-700/50 bg-slate-900/80 px-3 py-5">
      <div className="mb-4 px-2">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">AFL Control Room</span>
      </div>

      <div className="mb-4 px-2">
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">League</label>
        <select
          value={leagueSlug}
          onChange={(e) => onSwitchLeague(e.target.value)}
          disabled={switching}
          className="w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
        >
          <option value={leagueSlug}>{leagueSlug}</option>
          {leagues
            .filter((l) => l.slug !== leagueSlug)
            .map((l) => (
              <option key={l.id} value={l.slug}>
                {l.name}
              </option>
            ))}
        </select>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const href = `${base}${item.path}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={item.path}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-slate-400 hover:bg-slate-700/40 hover:text-slate-200"
              }`}
            >
              <span className="w-6 text-center text-xs">
                <item.icon size={16} className={active ? "text-blue-400" : "text-slate-400"} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 px-2 pb-1">
        <button onClick={logout} className="w-full rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-600">
          Sign Out
        </button>
        <div className="rounded-lg border border-slate-700/40 bg-slate-800/60 p-3 text-xs text-slate-500">
          Season 0 - Build v0.0.4
        </div>
      </div>
    </aside>
  );
}
