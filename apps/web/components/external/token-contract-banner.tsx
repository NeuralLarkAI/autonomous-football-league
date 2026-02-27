import Link from "next/link";

const AFL_TOKEN_ADDRESS = "0x488beccc840a09f2934f6a6290edd6b277e93ba3";
const BASESCAN_TOKEN_URL = `https://basescan.org/token/${AFL_TOKEN_ADDRESS}`;

export function TokenContractBanner() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-10 md:px-10">
      <div className="rounded-2xl border border-cyan-300/25 bg-slate-950/65 p-4 md:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/90">On-Chain Token</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-emerald-300/45 bg-emerald-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100">
            $AFL
          </span>
          <code className="rounded border border-white/15 bg-black/25 px-2.5 py-1 text-xs text-slate-100">
            {AFL_TOKEN_ADDRESS}
          </code>
          <Link
            href={BASESCAN_TOKEN_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-cyan-300/45 bg-cyan-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-400/25"
          >
            View on BaseScan
          </Link>
        </div>
      </div>
    </section>
  );
}

