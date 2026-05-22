import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseRepo,
  downloadsUrl,
  fetchPackageMeta,
  fetchDownloadsRange,
} from "@/lib/npm";

afterEach(() => vi.unstubAllGlobals());

describe("parseRepo", () => {
  it("strips git+ prefix and .git suffix", () =>
    expect(parseRepo("git+https://github.com/o/r.git")).toEqual({
      owner: "o",
      repo: "r",
    }));
  it("handles plain https github url with #readme", () =>
    expect(parseRepo("https://github.com/o/r#readme")).toEqual({
      owner: "o",
      repo: "r",
    }));
  it("handles git@github.com SSH form", () =>
    expect(parseRepo("git@github.com:o/r.git")).toEqual({
      owner: "o",
      repo: "r",
    }));
  it("returns null for non-github host", () =>
    expect(parseRepo("https://gitlab.com/o/r")).toBeNull());
  it("returns null for empty/undefined", () => {
    expect(parseRepo("")).toBeNull();
    expect(parseRepo(undefined)).toBeNull();
  });
});

describe("downloadsUrl", () => {
  it("encodes scoped slash as %2F (keeps @)", () =>
    expect(downloadsUrl("2026-01-01", "2026-02-01", "@s/n")).toContain(
      "/range/2026-01-01:2026-02-01/@s%2Fn",
    ));
  it("leaves unscoped name untouched", () =>
    expect(downloadsUrl("2026-01-01", "2026-02-01", "left-pad")).toContain(
      "/range/2026-01-01:2026-02-01/left-pad",
    ));
});

describe("fetchPackageMeta", () => {
  it("normalizes repo + reads latest version and publish time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          repository: { url: "git+https://github.com/o/r.git" },
          "dist-tags": { latest: "1.2.3" },
          time: { "1.2.3": "2026-05-01T00:00:00Z" },
        }),
      }),
    );
    expect(await fetchPackageMeta("r")).toEqual({
      repo: { owner: "o", repo: "r" },
      latestVersion: "1.2.3",
      lastPublishedAt: "2026-05-01T00:00:00Z",
    });
  });

  it("returns null repo when repository is missing or non-github", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ "dist-tags": { latest: "0.1.0" }, time: {} }),
      }),
    );
    const meta = await fetchPackageMeta("@sfrangulov/shared-memory-mcp");
    expect(meta.repo).toBeNull();
    expect(meta.latestVersion).toBe("0.1.0");
  });

  it("throws on 404 (package not found)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(fetchPackageMeta("nope-not-real")).rejects.toThrow();
  });
});

describe("fetchDownloadsRange", () => {
  it("returns daily points from the range API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        downloads: [
          { day: "2026-01-01", downloads: 10 },
          { day: "2026-01-02", downloads: 20 },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const points = await fetchDownloadsRange("left-pad", "2026-01-01", "2026-01-02");
    expect(points).toEqual([
      { day: "2026-01-01", downloads: 10 },
      { day: "2026-01-02", downloads: 20 },
    ]);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "api.npmjs.org/downloads/range/2026-01-01:2026-01-02/left-pad",
    );
  });

  it("returns [] when the API has no downloads field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    expect(await fetchDownloadsRange("x", "2026-01-01", "2026-01-02")).toEqual(
      [],
    );
  });
});
