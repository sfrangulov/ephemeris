import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardRedirect() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const login = auth?.user?.user_metadata?.user_name as string | undefined;
  if (!login) redirect("/login");
  redirect(`/u/${login}`);
}
