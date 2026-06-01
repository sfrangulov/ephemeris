import type { Status } from "@/lib/aggregate";
import { fmt } from "@/lib/format";
import { BadgeBuilder } from "@/components/dashboard/badge-builder";

/**
 * Stellar-magnitude scale for downloads.
 *   m = 10 - 2.5 · log10(dl)
 *   dl=10000 → m≈0 (bright)
 *   dl=100   → m≈5 (dim)
 *   dl=10    → m≈7.5 (very dim)
 * Returns a number we clamp to [0, 10]. Lower is brighter.
 */
function magnitude(dl: number): number {
  if (dl <= 0) return 10;
  return Math.max(0, Math.min(10, 10 - 2.5 * Math.log10(dl)));
}

/** Dot diameter in px, growing as magnitude decreases (brighter = larger). */
function dotSize(dl: number): number {
  const m = magnitude(dl);
  return Math.max(1.5, (10 - m) * 1.1 + 1.5);
}

interface MatrixRow {
  name: string;
  version: string | null;
  weeks: number[];
  status: Status;
  lastWeekDownloads: number;
  deltaDownloads: number;
  starsTotal: number;
  /** Net stars gained in the trailing 7 days (week-over-week). */
  deltaStars: number;
  lastPublishedAt: string | null;
}

const signed = (n: number) => `${n < 0 ? "−" : "+"}${fmt(Math.abs(n))}`;

/**
 * The ephemeris view: rows are packages (brightest first), columns are
 * trailing weeks. Each cell is a magnitude-scaled dot whose color encodes
 * week-over-week change for that package. The rightmost column carries the
 * literal numeric reading. The whole table is the artifact the product name
 * promises — positions over time.
 */
export function PortfolioMatrix({
  rows,
  isOwner = false,
  origin,
  slug,
}: {
  rows: MatrixRow[];
  isOwner?: boolean;
  origin?: string;
  slug?: string;
}) {
  if (rows.length === 0) return null;
  const showBuilder = isOwner && origin && slug;
  const weekCount = Math.max(...rows.map((r) => r.weeks.length));
  const weekLabels = Array.from({ length: weekCount }, (_, i) => {
    const back = weekCount - 1 - i;
    return back === 0 ? "now" : `−${back}w`;
  });

  return (
    <section className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[calc(var(--radius)*2)] border border-border/60 bg-card/30">
      <div className="min-h-0 flex-1 overflow-auto scroll-thin">
        <table className="mono w-full min-w-[760px] text-[11px]">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border/40 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="sticky left-0 bg-card px-4 py-2 text-left font-medium">
                package
              </th>
              {weekLabels.map((lbl, i) => (
                <th
                  key={i}
                  className={`px-1.5 py-2 text-center font-medium ${
                    i === weekCount - 1 ? "text-foreground/80" : ""
                  }`}
                >
                  {lbl}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">dl/wk</th>
              <th className="px-3 py-2 text-right font-medium">★</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const padded = padLeft(r.weeks, weekCount);
              return (
                <tr
                  key={r.name}
                  id={`pkg-${r.name}`}
                  className="group relative scroll-mt-6 cursor-pointer border-b border-border/20 transition-colors last:border-b-0 hover:bg-card/60 [&>td:not(:first-child)]:pointer-events-none"
                >
                  <td className="sticky left-0 bg-card/30 px-4 py-1.5">
                    <div className="flex items-baseline gap-2 font-sans">
                      <a
                        href={`https://www.npmjs.com/package/${r.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-[12px] font-medium text-foreground outline-none before:absolute before:inset-0 before:content-[''] group-hover:underline focus-visible:underline"
                      >
                        {r.name}
                      </a>
                      {r.version && (
                        <span className="text-[9px] text-muted-foreground/60">
                          v{r.version}
                        </span>
                      )}
                      {showBuilder && (
                        <BadgeBuilder origin={origin} slug={slug} pkg={r.name} />
                      )}
                    </div>
                  </td>
                  {padded.map((dl, i) => (
                    <td key={i} className="px-1.5 py-1.5 text-center align-middle">
                      <MagDot dl={dl} prev={padded[i - 1] ?? null} />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {fmt(r.lastWeekDownloads)}
                    {r.status !== "flat" && (
                      <span
                        className={`ml-1.5 text-[10px] ${
                          r.status === "up" ? "text-success" : "text-destructive"
                        }`}
                        title={`${signed(r.deltaDownloads)} dl this week`}
                      >
                        {signed(r.deltaDownloads)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    <span className="text-muted-foreground">
                      {fmt(r.starsTotal)}
                    </span>
                    {r.deltaStars !== 0 && (
                      <span
                        className={`ml-1.5 text-[10px] ${
                          r.deltaStars > 0 ? "text-success" : "text-destructive"
                        }`}
                        title={`${signed(r.deltaStars)} stars this week`}
                      >
                        {signed(r.deltaStars)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-border/40 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
        dot diameter scales with stellar magnitude · m = 10 − 2.5·log₁₀(dl)
      </footer>
    </section>
  );
}

function MagDot({ dl, prev }: { dl: number; prev: number | null }) {
  if (dl <= 0) {
    return <span className="inline-block size-1 rounded-full bg-muted-foreground/20" aria-label="0" />;
  }
  const d = dotSize(dl);
  let bg = "var(--muted-foreground)";
  if (prev != null && prev > 0) {
    const diff = dl - prev;
    const threshold = Math.max(prev * 0.05, Math.sqrt(prev));
    if (Math.abs(diff) > threshold) {
      bg = diff > 0 ? "var(--success)" : "var(--destructive)";
    }
  }
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: d, height: d, background: bg, opacity: 0.85 }}
      title={`${fmt(dl)} dl`}
      aria-label={`${dl} downloads`}
    />
  );
}

function padLeft<T>(arr: T[], len: number): (T | 0)[] {
  if (arr.length >= len) return arr.slice(-len);
  return [...Array<0>(len - arr.length).fill(0), ...arr];
}
