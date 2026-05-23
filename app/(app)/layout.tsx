import { AppSidebar, type SidebarUser } from "@/components/layout/app-sidebar";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolio } from "@/lib/portfolio";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [snapshot, { data: auth }] = await Promise.all([
    loadPortfolio(),
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
    <div className="flex min-h-[100dvh]">
      <AppSidebar
        packages={snapshot.packages.map((p) => ({
          name: p.name,
          status: p.status,
        }))}
        user={sidebarUser}
        freshness={snapshot.freshness ?? undefined}
      />
      <main className="grid-texture relative min-w-0 flex-1 overflow-auto scroll-thin">
        <div className="relative z-10 mx-auto max-w-[1080px] px-8 pb-16 pt-7">
          {children}
        </div>
      </main>
    </div>
  );
}
