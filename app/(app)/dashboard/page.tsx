import { StatStrip, type StatCell } from "@/components/dashboard/stat-strip";
import { PackageGrid } from "@/components/dashboard/package-grid";
import type { PackageCardData } from "@/components/dashboard/package-card";
import { weeklyBuckets, momentumStatus } from "@/lib/aggregate";
import { fmt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = Boolean(
    process.env.OWNER_GITHUB_LOGIN &&
      user?.user_metadata?.user_name === process.env.OWNER_GITHUB_LOGIN,
  );

  const { data: packages } = await supabase
    .from("packages")
    .select("id, name, latest_version, last_published_at");

  const ids = (packages ?? []).map((p) => p.id);
  const [{ data: downloads }, { data: starsData }] = await Promise.all([
    supabase
      .from("download_daily")
      .select("package_id, day, downloads")
      .in("package_id", ids)
      .order("day"),
    supabase
      .from("star_daily")
      .select("package_id, day, stars_total, stars_delta")
      .in("package_id", ids)
      .order("day"),
  ]);

  const dlByPkg = new Map<number, { day: string; downloads: number }[]>();
  for (const row of downloads ?? []) {
    const list = dlByPkg.get(row.package_id) ?? [];
    list.push({ day: row.day, downloads: row.downloads });
    dlByPkg.set(row.package_id, list);
  }
  const starByPkg = new Map<
    number,
    { day: string; stars_total: number; stars_delta: number }[]
  >();
  for (const row of starsData ?? []) {
    const list = starByPkg.get(row.package_id) ?? [];
    list.push(row);
    starByPkg.set(row.package_id, list);
  }

  const cards: PackageCardData[] = (packages ?? []).map((p) => {
    const weeks = weeklyBuckets(dlByPkg.get(p.id) ?? [], 13);
    const last = weeks.at(-1) ?? 0;
    const prev = weeks.at(-2) ?? 0;
    const starHistory = starByPkg.get(p.id) ?? [];
    const lastStar = starHistory.at(-1);
    const starsTotal = lastStar?.stars_total ?? 0;
    return {
      name: p.name,
      version: p.latest_version,
      status: momentumStatus(last, prev),
      lastWeekDownloads: last,
      deltaDownloads: last - prev,
      starsTotal,
      deltaStars: lastStar?.stars_delta ?? 0,
      weeks,
      // Star history is sparse until backfill runs; render a flat current line.
      starsSeries: weeks.map(() => starsTotal),
      lastPublishedAt: p.last_published_at,
    };
  });

  cards.sort((a, b) => b.lastWeekDownloads - a.lastWeekDownloads);

  const totalLast = cards.reduce((s, c) => s + c.lastWeekDownloads, 0);
  const totalPrev = cards.reduce(
    (s, c) => s + (c.lastWeekDownloads - c.deltaDownloads),
    0,
  );
  const totalRatio = totalPrev > 0 ? (totalLast - totalPrev) / totalPrev : 0;
  const total13 = cards.reduce((s, c) => s + c.weeks.reduce((a, b) => a + b, 0), 0);
  const totalStars = cards.reduce((s, c) => s + c.starsTotal, 0);
  const inNorm = cards.filter((c) => c.status !== "dn").length;

  const cells: StatCell[] = [
    {
      label: "Скачиваний / нед",
      value: fmt(totalLast),
      hint: `${totalRatio >= 0 ? "▲" : "▼"} ${(totalRatio * 100).toFixed(1)}% к прошлой`,
      status: totalRatio >= 0 ? "up" : "dn",
    },
    { label: "Всего звёзд", value: String(totalStars), hint: "портфель молодой" },
    { label: "Скачиваний / 13 нед", value: fmt(total13), hint: "история npm" },
    {
      label: "Пакетов в норме",
      value: `${inNorm} / ${cards.length}`,
      hint: "по динамике DL",
    },
  ];

  return (
    <>
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl">Обзор портфеля</h1>
        <span className="text-xs text-muted-foreground">
          {cards.length} пакетов · сортировка по скачиваниям/нед
        </span>
      </div>

      {cards.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Пакетов пока нет. Добавь первый, чтобы начать отслеживать скачивания и
          звёзды.
        </p>
      ) : (
        <>
          <StatStrip cells={cells} />
          <div className="my-6 flex items-center gap-3">
            <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">
              Портфель · импульс за неделю
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <PackageGrid packages={cards} editable={isOwner} />
        </>
      )}
    </>
  );
}
