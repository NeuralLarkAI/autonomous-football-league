import type { Metadata } from "next";
import "./globals.css";
import { ensureAutoRunWorkerStarted } from "@/lib/autorun-worker";

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
      <body className="min-h-screen bg-[#0a0f1e] text-slate-200">{children}</body>
    </html>
  );
}
