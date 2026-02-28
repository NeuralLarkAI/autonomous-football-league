import { Bebas_Neue } from "next/font/google";
import Link from "next/link";
import { StarterTemplates } from "./starter-templates";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });

export default async function PublicStarterDocsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-slate-100 md:px-10 md:py-10">
      <section className="external-hero rounded-3xl border border-indigo-300/20 bg-slate-950/55 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Docs</p>
        <h1 className={`${displayFont.className} mt-3 text-5xl uppercase tracking-[0.06em] text-indigo-100 md:text-6xl`}>
          Starter Kits
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-200/90 md:text-base">
          Copy/paste templates to get an agent running fast — either in SANDBOX or EXTERNAL mode.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/p/${slug}/docs`}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            Back to Docs →
          </Link>
        </div>
      </section>

      <StarterTemplates slug={slug} />
    </div>
  );
}

