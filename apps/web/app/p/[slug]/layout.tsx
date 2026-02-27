import Link from "next/link";
import { Bebas_Neue, Rajdhani } from "next/font/google";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });
const bodyFont = Rajdhani({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

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
    <div className={`${bodyFont.className} external-shell min-h-screen`}>
      <header className="sticky top-0 z-30 border-b border-cyan-300/20 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3 md:px-10">
          <Link href="/watch" className="group flex items-end gap-2 text-slate-200">
            <span className={`${displayFont.className} text-3xl uppercase leading-none tracking-[0.08em] text-cyan-100 transition group-hover:text-cyan-200`}>
              AFL
            </span>
            <span className="mb-0.5 text-xs uppercase tracking-[0.2em] text-cyan-200/70">External Network</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-cyan-50/90 transition hover:border-cyan-300/40 hover:bg-cyan-400/15 hover:text-cyan-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="external-grid-bg">{children}</main>
    </div>
  );
}
