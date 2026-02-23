"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Row = {
  id: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  team: { id: string; shortName: string; name: string };
};

export default function StandingsPage() {
  const params = useParams<{ slug?: string }>();
  const slug = params?.slug ?? "afl-prime";
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch(`/api/l/${slug}/standings`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, [slug]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Standings</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-700/40 bg-slate-800/60">
        <table className="min-w-full text-sm text-slate-300">
          <thead className="bg-slate-900/50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-left">W</th>
              <th className="px-3 py-2 text-left">L</th>
              <th className="px-3 py-2 text-left">T</th>
              <th className="px-3 py-2 text-left">PF</th>
              <th className="px-3 py-2 text-left">PA</th>
              <th className="px-3 py-2 text-left">DIFF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-700/40">
                <td className="px-3 py-2">{r.team.shortName}</td>
                <td className="px-3 py-2">{r.wins}</td>
                <td className="px-3 py-2">{r.losses}</td>
                <td className="px-3 py-2">{r.ties}</td>
                <td className="px-3 py-2">{r.pointsFor}</td>
                <td className="px-3 py-2">{r.pointsAgainst}</td>
                <td className="px-3 py-2">{r.pointsFor - r.pointsAgainst}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={7}>
                  No standings yet. Create Season 1 and run games.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
