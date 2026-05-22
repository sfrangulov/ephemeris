import type { Status } from "@/lib/aggregate";

export interface StatCell {
  label: string;
  value: string;
  hint: string;
  status?: Status;
}

const HINT_COLOR: Record<Status, string> = {
  up: "text-success",
  dn: "text-destructive",
  flat: "text-muted-foreground",
};

/** Dense horizontal portfolio summary: 4 bordered cells, mono values. */
export function StatStrip({ cells }: { cells: StatCell[] }) {
  return (
    <div className="my-5 flex overflow-hidden rounded-[calc(var(--radius)*4)] border border-border bg-card/50">
      {cells.map((c) => (
        <div
          key={c.label}
          className="flex-1 border-r border-border px-[18px] py-[15px] last:border-r-0"
        >
          <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {c.label}
          </div>
          <div className="mono mt-1.5 text-2xl font-bold">{c.value}</div>
          <div
            className={`mono mt-0.5 text-xs ${HINT_COLOR[c.status ?? "flat"]}`}
          >
            {c.hint}
          </div>
        </div>
      ))}
    </div>
  );
}
