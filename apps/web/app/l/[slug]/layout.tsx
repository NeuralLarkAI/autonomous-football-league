import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership } from "@/lib/league";
import { Sidebar } from "@/components/sidebar";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) redirect(`/l/afl-prime/dashboard`);
  const membership = await getMembership(league.id, user.id);
  if (!membership) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl">
        <Sidebar />
        <main className="min-h-screen flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
