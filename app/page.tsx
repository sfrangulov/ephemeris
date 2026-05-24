import Link from "next/link";
import { redirect } from "next/navigation";
import { PortfolioMatrix } from "@/components/dashboard/portfolio-matrix";
import { fmt } from "@/lib/format";
import { loadPortfolio } from "@/lib/portfolio";
import { getViewer } from "@/lib/viewer";

const DEMO_SLUG = "sfrangulov";

export default async function HomePage() {
  const viewer = await getViewer();
  if (viewer.login) redirect(`/u/${viewer.login}`);

  const snapshot = await loadPortfolio(DEMO_SLUG);
  const rows = snapshot.packages.map((p) => ({
    name: p.name,
    version: p.latestVersion,
    weeks: p.weeks,
    status: p.status,
    lastWeekDownloads: p.lastWeekDownloads,
    deltaDownloads: p.deltaDownloads,
    starsTotal: p.starsTotal,
    lastPublishedAt: p.lastPublishedAt,
  }));
  const totalLast = snapshot.weeklyTotals.at(-1) ?? 0;

  return (
    <main className="grid-texture relative min-h-[100dvh]">
      <div className="relative z-10 mx-auto max-w-[1080px] px-8 py-12">
        <header className="flex items-baseline justify-between">
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-full bg-success" />
            <div className="text-[13px] font-bold lowercase tracking-[0.04em]">
              ephemeris
            </div>
            <span className="ml-2 text-[11px] text-muted-foreground">
              observatory for npm portfolios
            </span>
          </div>
          <Link
            href="/login"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            sign in with github →
          </Link>
        </header>

        <p className="mt-6 max-w-[60ch] text-sm text-muted-foreground">
          daily downloads and github stars for a maintainer&apos;s packages,
          with weekly momentum.
        </p>

        <section className="mt-10">
          <div className="mono mb-3 flex items-baseline gap-4 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            <span className="text-foreground/80">/u/{DEMO_SLUG}</span>
            <span>{rows.length} packages</span>
            <span>Σ {fmt(totalLast)} dl/wk</span>
            <span className="ml-auto text-foreground/60">live demo</span>
          </div>
          {rows.length > 0 && <PortfolioMatrix rows={rows} />}
        </section>

        <footer className="mt-12 flex items-center gap-6 border-t border-border/40 pt-6 text-[11px] text-muted-foreground/70">
          <Link href={`/u/${DEMO_SLUG}`} className="hover:text-foreground">
            view /u/{DEMO_SLUG}
          </Link>
          <a
            href="https://github.com/sfrangulov/ephemeris"
            className="hover:text-foreground"
          >
            source
          </a>
          <span className="ml-auto">read-only public data</span>
        </footer>
      </div>
    </main>
  );
}
