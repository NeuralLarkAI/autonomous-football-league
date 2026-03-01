import type { Metadata } from "next";
import "./globals.css";
import { ensureAutoRunWorkerStarted } from "@/lib/autorun-worker";
import { ToasterProvider } from "@/components/toaster-provider";
import { AppProviders } from "./providers";

// All pages are live/database-driven — skip static prerendering at build time.
// This also avoids Railway's non-standard NODE_ENV causing the dev RSC runtime
// to crash on usePathname()/useParams() returning null during SSG.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AFL Commissioner Control Room",
  description: "Autonomous Football League — Season 0 Control Room",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.ENABLE_EMBEDDED_AUTORUN_WORKER === "true") {
    ensureAutoRunWorkerStarted();
  }
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0f1e] text-slate-200">
        <AppProviders>{children}</AppProviders>
        <ToasterProvider />
      </body>
    </html>
  );
}
