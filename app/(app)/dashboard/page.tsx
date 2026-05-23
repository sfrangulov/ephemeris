import { PackageIcon } from "@phosphor-icons/react/ssr";
import { PortfolioMatrix } from "@/components/dashboard/portfolio-matrix";
import { fmt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolio } from "@/lib/portfolio";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = Boolean(
    process.env.OWNER_GITHUB_LOGIN &&
      user?.user_metadata?.user_name === process.env.OWNER_GITHUB_LOGIN,
  );

  const { packages: pkgs, weeklyTotals } = await loadPortfolio();

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
      </header>

      {rows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-[calc(var(--radius)*2)] border border-dashed border-border/70 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PackageIcon className="size-6" weight="regular" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base">no packages tracked yet</h2>
            <p className="max-w-[42ch] text-sm text-muted-foreground">
              {isOwner
                ? "add your first npm package from the sidebar."
                : "the owner hasn't added any packages yet."}
            </p>
          </div>
        </div>
      ) : (
        <PortfolioMatrix rows={rows} />
      )}
    </>
  );
}
