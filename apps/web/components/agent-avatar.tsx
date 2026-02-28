type AgentAvatarProps = {
  name: string | null | undefined;
  department: string | null | undefined;
  size?: "sm" | "md";
};

export function AgentAvatar({ name, department, size = "md" }: AgentAvatarProps) {
  const initials = (name ?? "CO")
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

  const bg = colors[(department ?? "").toLowerCase()] ?? "bg-slate-700";
  const dims = size === "sm" ? "h-9 w-9 text-[11px]" : "h-11 w-11 text-xs";

  return <div className={`flex shrink-0 items-center justify-center rounded-full ${bg} font-bold text-white ${dims}`}>{initials}</div>;
}

