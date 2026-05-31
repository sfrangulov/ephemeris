import { NextResponse } from "next/server";
import {
  isTheme,
  loadBadgePackage,
  renderCard,
  renderMomentum,
  renderSparkline,
  renderStars,
  type Theme,
} from "@/lib/badge-pkg";
import { badgeNotFound } from "@/lib/badge";
import { isValidSlug } from "@/lib/slug";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";
// getViewer() reads auth cookies for the private-profile owner-view exception.
// Cacheable via Cache-Control, but never statically evaluated.
export const dynamic = "force-dynamic";

const RENDERERS = {
  "momentum.svg": renderMomentum,
  "sparkline.svg": renderSparkline,
  "stars.svg": renderStars,
  "card.svg": renderCard,
} as const;

type Variant = keyof typeof RENDERERS;

function isVariant(v: string): v is Variant {
  return v in RENDERERS;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; rest: string[] }> },
) {
  const { slug, rest } = await params;
  if (!isValidSlug(slug)) return badgeNotFound();
  if (rest.length < 2) return badgeNotFound();

  const variant = rest[rest.length - 1];
  if (!isVariant(variant)) return badgeNotFound();
  const pkgName = rest.slice(0, -1).join("/");

  const themeParam = new URL(req.url).searchParams.get("theme");
  const theme: Theme = themeParam && isTheme(themeParam) ? themeParam : "dark";

  const viewer = await getViewer();
  const data = await loadBadgePackage(slug, pkgName, viewer.userId);
  if (!data) return badgeNotFound();

  const svg = RENDERERS[variant](data, theme);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Client sees max-age=300 (Vercel strips s-maxage/SWR from the client
      // header). CDN-Cache-Control governs the edge: 1h fresh window caps the
      // displayed freshness-pill error (it's frozen into the SVG at render),
      // staying well inside the 6h sync cadence; a ≤1h SWR serve never hides
      // staleness beyond relAgo's tolerance.
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
