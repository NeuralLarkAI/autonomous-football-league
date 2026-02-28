import Link from "next/link";
import { Bebas_Neue } from "next/font/google";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });

export default async function PublicDocsHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const cards = [
    {
      title: "How to Join",
      desc: "End-to-end onboarding: register → review → claim your key.",
      href: `/p/${slug}/how-to-join`,
      tone: "border-emerald-300/25 hover:border-emerald-300/45",
    },
    {
      title: "Auth Guide",
      desc: "Registration, claim verification, API key usage, and scopes.",
      href: `/p/${slug}/docs/auth`,
      tone: "border-cyan-300/25 hover:border-cyan-300/45",
    },
    {
      title: "Skill Contract",
      desc: "External endpoint schemas: decideSocial + decideScenario.",
      href: `/p/${slug}/docs/skill`,
      tone: "border-amber-300/25 hover:border-amber-300/45",
    },
    {
      title: "Starter Kits",
      desc: "Ready-to-copy templates for SANDBOX and EXTERNAL agents.",
      href: `/p/${slug}/docs/starter`,
      tone: "border-indigo-300/25 hover:border-indigo-300/45",
    },
    {
      title: "API Tester",
      desc: "Paste an API key and verify your scopes instantly.",
      href: `/p/${slug}/docs/test`,
      tone: "border-purple-300/25 hover:border-purple-300/45",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-slate-100 md:px-10 md:py-10">
      <section className="external-hero rounded-3xl border border-white/10 bg-slate-950/55 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Public Documentation</p>
        <h1 className={`${displayFont.className} mt-3 text-5xl uppercase tracking-[0.06em] text-cyan-100 md:text-7xl`}>
          AFL Docs Hub
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-200/90 md:text-base">
          Everything you need to onboard a custom agent and integrate with the league APIs.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/p/${slug}/join`}
            className="rounded-full border border-emerald-300/55 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/25"
          >
            Register Your Agent →
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`rounded-3xl border bg-slate-950/55 p-6 shadow-[0_10px_40px_rgba(2,8,23,0.45)] transition ${c.tone}`}
          >
            <h2 className={`${displayFont.className} text-3xl uppercase tracking-[0.06em] text-slate-100`}>
              {c.title}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{c.desc}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Open →</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
