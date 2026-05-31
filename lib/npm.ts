import type { DailyPoint } from "./aggregate";

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface PackageMeta {
  repo: RepoRef | null;
  latestVersion: string | null;
  lastPublishedAt: string | null;
}

const REGISTRY = "https://registry.npmjs.org";
const DOWNLOADS = "https://api.npmjs.org/downloads";
const VERSIONS = "https://api.npmjs.org/versions";
const SEARCH = "https://registry.npmjs.org/-/v1/search";

/** npm path-encode a package name: only `/` -> `%2F`, keep the scope `@`. */
function enc(pkg: string): string {
  return pkg.replace(/\//g, "%2F");
}

/**
 * Pull `{ owner, repo }` out of an npm `repository.url`, tolerating the
 * `git+`, `.git`, `git://`, and `git@github.com:` forms plus `#`/`?` suffixes.
 * Returns null when the URL is empty or not a GitHub repo.
 */
export function parseRepo(url?: string | null): RepoRef | null {
  if (!url) return null;
  const m = url.match(
    /github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:[/#?].*)?$/i,
  );
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** Build the npm Downloads range API URL for a package. */
export function downloadsUrl(from: string, to: string, pkg: string): string {
  return `${DOWNLOADS}/range/${from}:${to}/${enc(pkg)}`;
}

/** Fetch registry metadata: GitHub repo, latest version, publish time. */
export async function fetchPackageMeta(pkg: string): Promise<PackageMeta> {
  const res = await fetch(`${REGISTRY}/${enc(pkg)}`);
  if (!res.ok) {
    throw new Error(`npm registry ${res.status} for ${pkg}`);
  }
  const meta = await res.json();
  const repoUrl =
    typeof meta.repository === "string"
      ? meta.repository
      : meta.repository?.url;
  const latestVersion: string | null = meta["dist-tags"]?.latest ?? null;
  const lastPublishedAt: string | null =
    (latestVersion ? meta.time?.[latestVersion] : undefined) ??
    meta.time?.modified ??
    null;
  return { repo: parseRepo(repoUrl), latestVersion, lastPublishedAt };
}

/** npm registry search URL filtered to a maintainer, with paging. */
export function searchUrl(maintainer: string, from: number, size: number): string {
  const text = encodeURIComponent(`maintainer:${maintainer}`);
  return `${SEARCH}?text=${text}&size=${size}&from=${from}`;
}

/** All package names a maintainer publishes, paging through the search API. */
export async function fetchPackagesByMaintainer(
  maintainer: string,
  size = 250,
): Promise<string[]> {
  const names: string[] = [];
  let from = 0;
  let total = Infinity;
  while (from < total) {
    const res = await fetch(searchUrl(maintainer, from, size));
    if (!res.ok) throw new Error(`npm search ${res.status} for ${maintainer}`);
    const data = await res.json();
    total = data.total ?? 0;
    const objects: { package: { name: string } }[] = data.objects ?? [];
    for (const o of objects) names.push(o.package.name);
    if (!objects.length) break;
    from += objects.length;
  }
  return names;
}

/** Fetch daily download points for a package over a date range. */
export async function fetchDownloadsRange(
  pkg: string,
  from: string,
  to: string,
): Promise<DailyPoint[]> {
  const res = await fetch(downloadsUrl(from, to, pkg));
  if (!res.ok) {
    throw new Error(`npm downloads ${res.status} for ${pkg}`);
  }
  const data = await res.json();
  return data.downloads ?? [];
}

export interface VersionDownload {
  version: string;
  downloads: number;
}

export interface VersionDownloadsWeek {
  /** npm's finalized last-week window-end (YYYY-MM-DD); null when unavailable. */
  weekEnding: string | null;
  versions: VersionDownload[];
}

/** npm per-version last-week endpoint URL (api.npmjs.org/versions). */
export function versionDownloadsUrl(pkg: string): string {
  return `${VERSIONS}/${enc(pkg)}/last-week`;
}

/** npm all-versions point URL for a period; carries the window start/end dates. */
export function pointUrl(period: string, pkg: string): string {
  return `${DOWNLOADS}/point/${period}/${enc(pkg)}`;
}

/** A stable release carries no semver prerelease component (no `-`). */
export function isStableVersion(version: string): boolean {
  return !version.includes("-");
}

/**
 * Parse npm's `{ '<version>': <count> }` last-week map into stable-only rows.
 * npm already omits zero-download versions; we additionally drop prereleases
 * and canaries (anything with a `-`) per the capture-granularity decision.
 */
export function parseVersionDownloads(
  downloads: Record<string, number> | undefined | null,
): VersionDownload[] {
  if (!downloads) return [];
  return Object.entries(downloads)
    .filter(([version, n]) => isStableVersion(version) && n != null)
    .map(([version, n]) => ({ version, downloads: n }));
}

/**
 * Weekly per-version downloads for a package: the stable-release split plus
 * npm's canonical last-week window-end. An unknown package answers 200 with an
 * empty map, so we return no versions (and skip the window call) and the caller
 * stores nothing. The per-version map is authoritative for the RELATIVE split
 * only; it does not reconcile to the all-versions point total.
 */
export async function fetchVersionDownloadsLastWeek(
  pkg: string,
): Promise<VersionDownloadsWeek> {
  const res = await fetch(versionDownloadsUrl(pkg));
  if (!res.ok) throw new Error(`npm versions ${res.status} for ${pkg}`);
  const data = await res.json();
  const versions = parseVersionDownloads(data.downloads);
  if (!versions.length) return { weekEnding: null, versions: [] };

  const pres = await fetch(pointUrl("last-week", pkg));
  if (!pres.ok) throw new Error(`npm point ${pres.status} for ${pkg}`);
  const point = await pres.json();
  return { weekEnding: point.end ?? null, versions };
}
