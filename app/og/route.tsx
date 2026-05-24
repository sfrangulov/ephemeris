import { ImageResponse } from "next/og";
import {
  COLORS,
  dotColor,
  dotSize,
  fmtCompact,
  loadBadge,
  signedCompact,
} from "@/lib/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 1200;
const H = 630;
const PAD = 72;

export async function GET() {
  const { rows, freshness, totalPackages, totalWeeklyDownloads } =
    await loadBadge();

  const weekSlotW = 64;
  const weeksTotalW = weekSlotW * 7;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: COLORS.bg,
          color: COLORS.fg,
          padding: PAD,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              background: COLORS.success,
              marginRight: 14,
            }}
          />
          <div style={{ fontSize: 36, fontWeight: 700 }}>ephemeris</div>
          <div
            style={{
              marginLeft: "auto",
              color: COLORS.muted,
              fontSize: 20,
              display: "flex",
            }}
          >
            {totalPackages} pkgs · Σ {fmtCompact(totalWeeklyDownloads)} dl/wk
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: COLORS.faint,
            fontSize: 16,
            marginTop: 48,
            paddingBottom: 14,
            borderBottom: `1px solid ${COLORS.border}`,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          <div style={{ flex: 1 }}>package</div>
          <div
            style={{
              width: weeksTotalW,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                style={{
                  width: weekSlotW,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {i === 6 ? "now" : `−${6 - i}w`}
              </div>
            ))}
          </div>
          <div style={{ width: 140, display: "flex", justifyContent: "flex-end" }}>
            dl/wk
          </div>
          <div style={{ width: 100, display: "flex", justifyContent: "flex-end" }}>
            Δ
          </div>
          <div style={{ width: 100, display: "flex", justifyContent: "flex-end" }}>
            ★
          </div>
        </div>

        {rows.map((r) => (
          <div
            key={r.name}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "22px 0",
              borderBottom: `1px solid ${COLORS.border}`,
              fontSize: 24,
            }}
          >
            <div style={{ flex: 1, display: "flex" }}>{r.name}</div>
            <div
              style={{
                width: weeksTotalW,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {r.weeks.map((dl, i, arr) => {
                if (dl <= 0) {
                  return (
                    <div
                      key={i}
                      style={{
                        width: weekSlotW,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: COLORS.muted,
                          opacity: 0.2,
                        }}
                      />
                    </div>
                  );
                }
                const d = dotSize(dl, 2.4);
                const color = dotColor(dl, arr[i - 1]);
                return (
                  <div
                    key={i}
                    style={{
                      width: weekSlotW,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: d,
                        height: d,
                        borderRadius: d / 2,
                        background: color,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              style={{
                width: 140,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              {fmtCompact(r.lastWeekDownloads)}
            </div>
            <div
              style={{
                width: 100,
                display: "flex",
                justifyContent: "flex-end",
                color:
                  r.status === "up"
                    ? COLORS.success
                    : r.status === "dn"
                      ? COLORS.destructive
                      : COLORS.muted,
              }}
            >
              {signedCompact(r.deltaDownloads)}
            </div>
            <div
              style={{
                width: 100,
                display: "flex",
                justifyContent: "flex-end",
                color: COLORS.muted,
              }}
            >
              ★ {fmtCompact(r.starsTotal)}
            </div>
          </div>
        ))}

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            color: COLORS.faint,
            fontSize: 18,
          }}
        >
          <div style={{ display: "flex" }}>ephemeris-dev.vercel.app</div>
          <div style={{ display: "flex" }}>{freshness ?? ""}</div>
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
