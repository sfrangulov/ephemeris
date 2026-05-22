export interface RepoStats {
  stars: number;
  forks: number;
}

export interface BackfillResult {
  timestamps: string[];
  truncated: boolean;
}

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";

/** Parse a GitHub `Link` header into a `{ rel: url }` map. */
export function parseLinkHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(",")) {
    const m = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (m) out[m[2]] = m[1];
  }
  return out;
}

/** Current stargazer + fork counts for a repo. */
export async function fetchRepoStats(
  owner: string,
  repo: string,
  token: string,
): Promise<RepoStats> {
  const res = await fetch(`${API}/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": API_VERSION,
    },
  });
  if (!res.ok) {
    throw new Error(`github repo ${res.status} for ${owner}/${repo}`);
  }
  const data = await res.json();
  return { stars: data.stargazers_count, forks: data.forks_count };
}

/**
 * Page through a repo's stargazers collecting `starred_at` timestamps.
 * Uses the `star+json` media type (adds timestamps) and follows the `Link`
 * rel="next" cursor. Caps at `maxPages` (GitHub allows ~400 = 40K stars);
 * beyond the cap, returns `truncated: true`.
 */
export async function backfillStargazers(
  owner: string,
  repo: string,
  token: string,
  maxPages = 400,
): Promise<BackfillResult> {
  const timestamps: string[] = [];
  let url = `${API}/repos/${owner}/${repo}/stargazers?per_page=100`;
  let pages = 0;
  let truncated = false;

  while (url) {
    if (pages >= maxPages) {
      truncated = true;
      break;
    }
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.star+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": API_VERSION,
      },
    });
    if (!res.ok) {
      throw new Error(`github stargazers ${res.status} for ${owner}/${repo}`);
    }
    const page = await res.json();
    for (const item of page) {
      if (item?.starred_at) timestamps.push(item.starred_at);
    }
    pages++;
    url = parseLinkHeader(res.headers.get("link")).next ?? "";
  }

  return { timestamps, truncated };
}
