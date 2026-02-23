import { redirect } from "next/navigation";

export default async function LeagueRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/l/${slug}/dashboard`);
}
