"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "[]"},
  { href: "/agents", label: "Agents", icon: "<>"},
  { href: "/tasks", label: "Tasks", icon: "##"},
  { href: "/approvals", label: "Approvals", icon: "OK"},
  { href: "/social", label: "Social", icon: "MB"},
  { href: "/combine", label: "Combine", icon: "CB"},
  { href: "/incidents", label: "Incidents", icon: "!!"},
  { href: "/ops", label: "Ops", icon: "{}"},
  { href: "/feed", label: "Activity Feed", icon: ".."},
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-slate-700/50 bg-slate-900/80 px-3 py-5">
      <div className="mb-6 px-2">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">AFL Control Room</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-slate-400 hover:bg-slate-700/40 hover:text-slate-200"
              }`}
            >
              <span className="w-6 text-center text-xs">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 pb-1">
        <div className="rounded-lg border border-slate-700/40 bg-slate-800/60 p-3 text-xs text-slate-500">
          Season 0 · Build v0.0.2
        </div>
      </div>
    </aside>
  );
}
