import { notFound } from "next/navigation";
import { AppTopbar, type TopbarUser } from "@/components/layout/app-topbar";
import { SyncButton } from "@/components/dashboard/sync-button";
import { loadPortfolio } from "@/lib/portfolio";
import { isValidSlug } from "@/lib/slug";
import { getViewer } from "@/lib/viewer";

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const viewer = await getViewer();
  const snapshot = await loadPortfolio(slug, viewer.userId);

  const topbarUser: TopbarUser | null = viewer.userId
    ? {
        login: viewer.login ?? viewer.userId.slice(0, 8),
        name: viewer.fullName,
        avatarUrl: viewer.avatarUrl,
        isOwner: viewer.isOwner,
      }
    : null;

  const isSelfView = Boolean(viewer.login && viewer.login === slug);

  return (
    <div className="flex h-[100dvh] flex-col">
      <AppTopbar user={topbarUser} freshness={snapshot.freshness ?? undefined} />
      <main className="grid-texture relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="relative z-10 mx-auto flex h-full max-w-[1080px] flex-col px-8 pb-6 pt-7">
          {children}
        </div>
      </main>
      {isSelfView && topbarUser?.isOwner && <SyncButton />}
    </div>
  );
}
