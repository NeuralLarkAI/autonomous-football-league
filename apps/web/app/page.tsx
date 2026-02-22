export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">
            Commissioner Control Room
          </h1>
          <p className="mt-1 text-slate-400">
            Autonomous Football League — Season 0
          </p>
        </div>
        <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-medium text-amber-400 ring-1 ring-amber-500/40">
          PRE-SEASON
        </span>
      </div>

      {/* Stat cards placeholder */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Agents", value: "—" },
          { label: "Open Tasks", value: "—" },
          { label: "Pending Approvals", value: "—" },
          { label: "Events Today", value: "—" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5"
          >
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6">
        <p className="text-slate-400">
          Run the seed script and kickoff to populate data:
        </p>
        <pre className="mt-3 rounded-lg bg-slate-900 p-4 text-sm text-green-400">
          pnpm db:migrate{"\n"}pnpm seed{"\n"}# Then press &quot;Run Kickoff&quot; in the Agents page
        </pre>
      </div>
    </div>
  );
}
