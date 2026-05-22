import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseLinkHeader,
  fetchRepoStats,
  backfillStargazers,
} from "@/lib/github";

afterEach(() => vi.unstubAllGlobals());

/** Build a minimal fetch Response stub with a Link header. */
function res(body: unknown, link: string | null = null, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    headers: { get: (k: string) => (k.toLowerCase() === "link" ? link : null) },
  };
}

describe("parseLinkHeader", () => {
  it("extracts rel targets", () => {
    const h =
      '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=5>; rel="last"';
    expect(parseLinkHeader(h)).toEqual({
      next: "https://api.github.com/x?page=2",
      last: "https://api.github.com/x?page=5",
    });
  });
  it("returns {} for null", () => expect(parseLinkHeader(null)).toEqual({}));
});

describe("fetchRepoStats", () => {
  it("returns current stars and forks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(res({ stargazers_count: 42, forks_count: 7 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchRepoStats("o", "r", "tok")).toEqual({
      stars: 42,
      forks: 7,
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/repos/o/r");
  });
});

describe("backfillStargazers", () => {
  it("collects starred_at across paginated pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        res(
          [{ starred_at: "2026-01-01T00:00:00Z" }],
          '<https://api.github.com/next>; rel="next"',
        ),
      )
      .mockResolvedValueOnce(res([{ starred_at: "2026-01-02T00:00:00Z" }], null));
    vi.stubGlobal("fetch", fetchMock);

    const out = await backfillStargazers("o", "r", "tok");
    expect(out.timestamps).toEqual([
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
    ]);
    expect(out.truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requests the star+json media type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res([], null));
    vi.stubGlobal("fetch", fetchMock);
    await backfillStargazers("o", "r", "tok");
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Accept).toBe("application/vnd.github.star+json");
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("stops and flags truncated at the page cap", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        res(
          [{ starred_at: "2026-01-01T00:00:00Z" }],
          '<https://api.github.com/next>; rel="next"',
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const out = await backfillStargazers("o", "r", "tok", 2);
    expect(out.truncated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
