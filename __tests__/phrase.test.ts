import { describe, it, expect } from "vitest";
import {
  computeInsights,
  template,
  violatesRegister,
  ungroundedNumbers,
  phrase,
  type WeeklyInsightFacts,
} from "@/lib/phrase";

const PORT: WeeklyInsightFacts = {
  kind: "weekly-insight",
  packages: [
    { name: "docx-to-md", downloads: 7000, prevDownloads: 6000, lastPublishDays: 5 },
    { name: "skill-graveyard", downloads: 200, prevDownloads: 100, lastPublishDays: 10 },
    { name: "old-thing", downloads: 1, prevDownloads: 1, lastPublishDays: 120 },
    { name: "penwick", downloads: 50, prevDownloads: 52, lastPublishDays: 20 },
  ],
};

describe("computeInsights", () => {
  const ins = computeInsights(PORT);
  const byId = (id: string) => ins.find((i) => i.id === id);

  it("ranks concentration highest and shows the contrast (not a vague nudge)", () => {
    expect(ins[0].id).toBe("concentration");
    expect(ins[0].text).toBe(
      "docx-to-md is 97% of your 7 251 weekly downloads; the other 3 sum to 251",
    );
  });

  it("surfaces the biggest real mover with prev→now (noise-gated)", () => {
    expect(byId("up")?.text).toBe("skill-graveyard 100→200 dl/wk (+100%)");
  });

  it("names archive candidates and gives a concrete action", () => {
    const a = byId("archive");
    expect(a?.recommends).toBe(true);
    expect(a?.text).toBe(
      "old-thing: under 5 dl/wk and 90+ days stale; deprecate or archive",
    );
  });

  it("ignores sub-noise wiggle (penwick 50 vs 52 is not a move)", () => {
    expect(ins.every((i) => !i.text.includes("penwick"))).toBe(true);
  });

  it("every computed insight is register-clean", () => {
    for (const i of ins) expect(violatesRegister(i.text)).toBeNull();
  });

  it("always yields at least the total baseline", () => {
    const flat = computeInsights({
      kind: "weekly-insight",
      packages: [{ name: "a", downloads: 3, prevDownloads: 3, lastPublishDays: 1 }],
    });
    expect(flat.at(-1)?.id).toBe("total");
    expect(flat[0].text).toBe("3 downloads this week across 1 package");
  });
});

describe("template", () => {
  it("is the single most salient computed insight", () => {
    expect(template(PORT)).toBe(computeInsights(PORT)[0].text);
  });
});

describe("violatesRegister", () => {
  it("flags usage words — downloads are not people/users/adoption", () => {
    expect(violatesRegister("847 people downloaded your work")).toBe(
      "banned word: people",
    );
    expect(violatesRegister("more users this week")).toBe("banned word: users");
    expect(violatesRegister("real adoption is up")).toBe("banned word: adoption");
  });

  it("flags vague business advice (forces a concrete fallback)", () => {
    expect(violatesRegister("docx-to-md is 97%; diversify")).toBe(
      "vague advice: diversify",
    );
    expect(violatesRegister("optimize your downloads")).toBe(
      "vague advice: optimize",
    );
  });

  it("flags marketing words, em-dash, emoji, exclamation", () => {
    expect(violatesRegister("amazing growth")).toBe("banned word: amazing");
    expect(violatesRegister("downloads up — nice")).toBe("em-dash");
    expect(violatesRegister("downloads up 🚀")).toBe("emoji");
    expect(violatesRegister("downloads up!")).toBe("exclamation");
  });

  it("passes a clean honest insight", () => {
    expect(violatesRegister(template(PORT))).toBeNull();
  });
});

describe("ungroundedNumbers (anti-hallucination guard)", () => {
  it("passes when every number is grounded in the allowed set", () => {
    const allowed = new Set(["97", "7251"]);
    expect(
      ungroundedNumbers("docx-to-md is 97% of your 7 251 weekly downloads", allowed),
    ).toEqual([]);
  });

  it("flags an invented number", () => {
    const allowed = new Set(["97", "7251"]);
    expect(
      ungroundedNumbers("docx-to-md is 999% of your 7 251 weekly downloads", allowed),
    ).toEqual(["999"]);
  });
});

describe("phrase", () => {
  it("falls back to the top computed insight when no DEEPSEEK_API_KEY is set", async () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      expect(await phrase(PORT)).toBe(template(PORT));
    } finally {
      if (prev !== undefined) process.env.DEEPSEEK_API_KEY = prev;
    }
  });
});
