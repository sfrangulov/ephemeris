import { AppTopbar, type TopbarUser } from "@/components/layout/app-topbar";
import { SyncButton } from "@/components/dashboard/sync-button";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolio } from "@/lib/portfolio";

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  const viewerUserId = user?.id ?? null;
  const snapshot = await loadPortfolio(slug, viewerUserId);

  const login = user?.user_metadata?.user_name as string | undefined;
  const topbarUser: TopbarUser | null = user
    ? {
        login: login ?? user.id.slice(0, 8),
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          login ??
          "",
        avatarUrl:
          (user.user_metadata?.avatar_url as string | undefined) ?? null,
        isOwner: Boolean(
          process.env.OWNER_USER_ID && user.id === process.env.OWNER_USER_ID,
        ),
      }
    : null;

  const isSelfView = Boolean(login && login === slug);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppTopbar user={topbarUser} freshness={snapshot.freshness ?? undefined} />
      <main className="grid-texture relative min-w-0 flex-1 overflow-auto scroll-thin">
        <div className="relative z-10 mx-auto max-w-[1080px] px-8 pb-16 pt-7">
          {children}
        </div>
      </main>
      {isSelfView && topbarUser?.isOwner && <SyncButton />}
    </div>
  );
}
