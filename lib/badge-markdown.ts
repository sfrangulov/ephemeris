import type { Theme } from "@/lib/badge-pkg";

export type BadgeVariant = "momentum" | "sparkline" | "stars" | "card";

export const BADGE_VARIANTS: readonly BadgeVariant[] = [
  "momentum",
  "sparkline",
  "stars",
  "card",
] as const;

export const BADGE_THEMES: readonly Theme[] = ["dark", "light", "auto"] as const;

export function buildBadgeUrl(
  origin: string,
  slug: string,
  pkg: string,
  variant: BadgeVariant,
  theme: Theme,
): string {
  const base = `${origin}/badge/${slug}/${pkg}/${variant}.svg`;
  // Route default is dark; omit the query for the dark case to keep README diffs minimal.
  return theme === "dark" ? base : `${base}?theme=${theme}`;
}

export function buildBadgeMarkdown(
  origin: string,
  slug: string,
  pkg: string,
  variant: BadgeVariant,
  theme: Theme,
): string {
  const url = buildBadgeUrl(origin, slug, pkg, variant, theme);
  return `[![${pkg}](${url})](https://www.npmjs.com/package/${pkg})`;
}
