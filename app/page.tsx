import { redirect } from "next/navigation";

// Until auth (M5) has a landing, root forwards to the dashboard. If an OAuth
// code lands here (Supabase Site-URL fallback), forward it to the callback so
// the session still exchanges instead of being dropped on the root.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  if (code) redirect(`/auth/callback?code=${code}`);
  redirect("/dashboard");
}
