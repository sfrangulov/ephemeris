"use client";

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import type { Status } from "@/lib/aggregate";

const AREA_COLOR: Record<Status, string> = {
  up: "var(--success)",
  dn: "var(--destructive)",
  flat: "var(--muted-foreground)",
};
const STAR_COLOR = "var(--primary)";

/** Render an endpoint dot only on the final data point. */
function endDot(color: string, lastIndex: number) {
  return function Dot(props: { cx?: number; cy?: number; index?: number }) {
    if (props.index !== lastIndex || props.cx == null || props.cy == null) {
      return <g />;
    }
    return <circle cx={props.cx} cy={props.cy} r={2.6} fill={color} />;
  };
}

/**
 * Combined sparkline: downloads as a status-colored gradient area, stars as a
 * primary line on an independent axis so a near-flat star count stays legible.
 */
export function DualChart({
  weeks,
  stars,
  status,
}: {
  weeks: number[];
  stars: number[];
  status: Status;
}) {
  const areaColor = AREA_COLOR[status];
  const data = weeks.map((dl, i) => ({
    i,
    dl,
    star: stars[i] ?? stars.at(-1) ?? 0,
  }));
  const last = data.length - 1;
  const gradId = `dl-grad-${status}`;
  const maxStar = Math.max(1, ...stars);

  return (
    <ResponsiveContainer width="100%" height={56}>
      <ComposedChart data={data} margin={{ top: 4, right: 3, bottom: 2, left: 3 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={areaColor} stopOpacity={0.26} />
            <stop offset="1" stopColor={areaColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis yAxisId="dl" hide domain={[0, "dataMax"]} />
        <YAxis yAxisId="star" hide domain={[0, maxStar * 6]} />
        <Area
          yAxisId="dl"
          dataKey="dl"
          type="monotone"
          stroke={areaColor}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          isAnimationActive={false}
          dot={endDot(areaColor, last)}
        />
        <Line
          yAxisId="star"
          dataKey="star"
          type="monotone"
          stroke={STAR_COLOR}
          strokeWidth={1.5}
          isAnimationActive={false}
          dot={endDot(STAR_COLOR, last)}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
