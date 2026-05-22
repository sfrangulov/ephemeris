import { AppSidebar, type SidebarUser } from "@/components/layout/app-sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: packages }, { data: auth }] = await Promise.all([
    supabase.from("packages").select("name").order("name"),
    supabase.auth.getUser(),
  ]);

  const user = auth?.user ?? null;
  const login = user?.user_metadata?.user_name as string | undefined;
  const sidebarUser: SidebarUser | null = user
    ? {
        login: login ?? user.id.slice(0, 8),
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          login ??
          "",
        isOwner: Boolean(
          process.env.OWNER_GITHUB_LOGIN &&
            login === process.env.OWNER_GITHUB_LOGIN,
        ),
      }
    : null;

  return (
    <div className="flex min-h-screen">
      <AppSidebar packages={packages ?? []} user={sidebarUser} />
      <main className="grid-texture relative min-w-0 flex-1 overflow-auto scroll-thin">
        <div className="relative z-10 mx-auto max-w-[1080px] px-8 pb-16 pt-7">
          {children}
        </div>
      </main>
    </div>
  );
}
