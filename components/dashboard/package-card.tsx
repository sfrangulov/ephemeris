import { DualChart } from "@/components/dashboard/dual-chart";
import type { Status } from "@/lib/aggregate";
import { fmt, rel } from "@/lib/format";

export interface PackageCardData {
  name: string;
  version: string | null;
  status: Status;
  lastWeekDownloads: number;
  deltaDownloads: number;
  starsTotal: number;
  deltaStars: number;
  weeks: number[];
  starsSeries: number[];
  lastPublishedAt: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  up: "▲ рост",
  flat: "— штиль",
  dn: "▼ спад",
};
const STATUS_TEXT: Record<Status, string> = {
  up: "text-success",
  dn: "text-destructive",
  flat: "text-muted-foreground",
};
const STRIPE: Record<Status, string> = {
  up: "bg-success",
  dn: "bg-destructive",
  flat: "bg-muted-foreground/40",
};
const DOT: Record<Status, string> = {
  up: "var(--success)",
  dn: "var(--destructive)",
  flat: "var(--muted-foreground)",
};

const signed = (n: number) => `${n < 0 ? "−" : "+"}${fmt(Math.abs(n))}`;

export function PackageCard(c: PackageCardData) {
  return (
    <div className="glass-card cursor-pointer px-4 pb-3 pt-3.5">
      {/*
        Semantic 3px status stripe. Formally on impeccable's side-stripe ban
        list; kept deliberately as a status indicator (see spec §7).
      */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${STRIPE[c.status]}`} />

      <div className="flex items-center gap-1.5">
        <span className="flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {c.name}
        </span>
        {c.version && (
          <span className="mono rounded-[4px] border border-border px-1.5 py-px text-[9px] leading-[1.4] text-muted-foreground">
            v{c.version}
          </span>
        )}
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.06em] ${STATUS_TEXT[c.status]}`}
        >
          {STATUS_LABEL[c.status]}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-3.5">
        <span className="inline-flex items-baseline gap-1.5">
          <span
            className="size-[7px] self-center rounded-full"
            style={{ background: DOT[c.status] }}
          />
          <span className="mono text-[21px] font-bold">
            {fmt(c.lastWeekDownloads)}
          </span>
          <span className="text-[11px] text-muted-foreground">dl / нед</span>
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          <span
            className="size-[7px] self-center rounded-full"
            style={{ background: "var(--primary)" }}
          />
          <span className="mono text-base font-bold">{c.starsTotal}</span>
          <span className="text-[11px] text-muted-foreground">★</span>
        </span>
      </div>

      <div className="mt-2.5">
        <DualChart weeks={c.weeks} stars={c.starsSeries} status={c.status} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`mono text-xs font-semibold ${STATUS_TEXT[c.status]}`}>
          {signed(c.deltaDownloads)} dl · {signed(c.deltaStars)}★
        </span>
        {c.lastPublishedAt && (
          <span className="mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground/75">
            обновлён {rel(c.lastPublishedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
