import Link from "next/link";
import { redirect } from "next/navigation";
import { PortfolioMatrix } from "@/components/dashboard/portfolio-matrix";
import { Logo } from "@/components/layout/logo";
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
    deltaStars: p.deltaStars,
    lastPublishedAt: p.lastPublishedAt,
  }));
  const totalLast = snapshot.weeklyTotals.at(-1) ?? 0;

  return (
    <main className="grid-texture relative h-[100dvh] overflow-hidden">
      <div className="relative z-10 mx-auto flex h-full max-w-[1080px] flex-col px-8 pb-6 pt-7">
        <header className="flex shrink-0 items-baseline justify-between">
          <Logo className="text-[26px] text-foreground" />
          <Link
            href="/login"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            sign in with github →
          </Link>
        </header>

        <p className="mt-4 shrink-0 text-sm text-muted-foreground">
          daily downloads and github stars for a maintainer&apos;s packages,
          with weekly momentum.
        </p>

        <section className="mt-6 flex min-h-0 flex-1 flex-col">
          <div className="mono mb-3 flex shrink-0 items-baseline gap-4 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            <span className="text-foreground/80">/u/{DEMO_SLUG}</span>
            <span>{rows.length} packages</span>
            <span>Σ {fmt(totalLast)} dl/wk</span>
            <span className="ml-auto text-foreground/60">live demo</span>
          </div>
          {rows.length > 0 && <PortfolioMatrix rows={rows} />}
        </section>

        <footer className="mt-6 flex shrink-0 items-center gap-6 border-t border-border/40 pt-4 text-[11px] text-muted-foreground/70">
          <a
            href="https://github.com/sfrangulov/ephemeris"
            className="hover:text-foreground"
          >
            source
          </a>
          <a
            href="https://github.com/sfrangulov"
            className="ml-auto hover:text-foreground"
          >
            © 2026 Sergei Frangulov
          </a>
        </footer>
      </div>
    </main>
  );
}
