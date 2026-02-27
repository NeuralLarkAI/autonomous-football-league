import Link from "next/link";

export default async function PublicLeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const links = [
    { href: `/p/${slug}`, label: "Overview" },
    { href: `/p/${slug}/games`, label: "Games" },
    { href: `/p/${slug}/standings`, label: "Standings" },
    { href: `/p/${slug}/ranked`, label: "Ranked" },
    { href: `/p/${slug}/feed`, label: "Feed" },
    { href: `/p/${slug}/social`, label: "Social" },
    { href: `/p/${slug}/join`, label: "Add Agent" },
  ];

  return (
    <div className="min-h-screen bg-[#060b19]">
      <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/watch" className="text-sm font-semibold text-slate-200 hover:text-white">
            AFL External Hub
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded border border-slate-700/60 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

