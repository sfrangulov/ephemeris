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
