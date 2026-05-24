import { PackageIcon } from "@phosphor-icons/react/ssr";
import { notFound } from "next/navigation";
import { PortfolioMatrix } from "@/components/dashboard/portfolio-matrix";
import { fmt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolio } from "@/lib/portfolio";
import { isValidSlug } from "@/lib/slug";
import { headers } from "next/headers";
import { PublicToggle } from "@/components/dashboard/public-toggle";
import { CopyBadge } from "@/components/dashboard/copy-badge";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  const login = user?.user_metadata?.user_name as string | undefined;
  const isSelfView = Boolean(login && login === slug);

  const snapshot = await loadPortfolio(slug, user?.id ?? null);
  const { packages: pkgs, weeklyTotals } = snapshot;

  const host = (await headers()).get("host") ?? "ephemeris-dev.vercel.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  const rows = pkgs.map((p) => ({
    name: p.name,
    version: p.latestVersion,
    weeks: p.weeks,
    status: p.status,
    lastWeekDownloads: p.lastWeekDownloads,
    deltaDownloads: p.deltaDownloads,
    starsTotal: p.starsTotal,
    lastPublishedAt: p.lastPublishedAt,
  }));

  const totalLast = weeklyTotals.at(-1) ?? 0;
  const totalPrev = weeklyTotals.at(-2) ?? 0;
  const totalRatio = totalPrev > 0 ? (totalLast - totalPrev) / totalPrev : 0;
  const rising = rows.filter((r) => r.status === "up").length;
  const falling = rows.filter((r) => r.status === "dn").length;
  const flat = rows.length - rising - falling;

  return (
    <>
      <header className="mono flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        <span className="text-foreground/80">{rows.length} packages</span>
        <span>
          Σ <span className="text-foreground/80">{fmt(totalLast)}</span> dl/wk
        </span>
        <span className={totalRatio >= 0 ? "text-success" : "text-destructive"}>
          {totalRatio >= 0 ? "+" : "−"}
          {Math.abs(totalRatio * 100).toFixed(1)}% w/w
        </span>
        <span>
          <span className="text-success">{rising}↑</span>{" "}
          <span className="text-destructive">{falling}↓</span>{" "}
          <span>{flat}·</span>
        </span>
        <span className="ml-auto text-foreground/60">/u/{slug}</span>
      </header>

      {rows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-[calc(var(--radius)*2)] border border-dashed border-border/70 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PackageIcon className="size-6" weight="regular" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base">no npm packages found</h2>
            <p className="max-w-[42ch] text-sm text-muted-foreground">
              {isSelfView
                ? `ephemeris looks for packages where '${slug}' is an npm maintainer. if your github login differs from your npm username, this is the expected state for now.`
                : `nothing tracked for ${slug} yet.`}
            </p>
          </div>
        </div>
      ) : (
        <PortfolioMatrix rows={rows} />
      )}

      {isSelfView && (
        <section className="mono mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/40 pt-6 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          <PublicToggle initialPublic={snapshot.profile.isPublic} />
          <CopyBadge origin={origin} slug={slug} />
        </section>
      )}
    </>
  );
}
