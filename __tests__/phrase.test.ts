import { describe, it, expect } from "vitest";
import {
  computeInsights,
  template,
  violatesRegister,
  ungroundedNumbers,
  phrase,
  selectInsights,
  toStackItems,
  type Insight,
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

describe("version-EOL rule", () => {
  // v5 dominates (90%); v3 is a shrunk-but-real tail (8%); v4 is tiny (2%).
  const eolPkg = {
    name: "lib-x",
    downloads: 1000,
    prevDownloads: 1000,
    lastPublishDays: 10,
    versions: [
      { version: "5.0.1", downloads: 800 },
      { version: "5.0.0", downloads: 100 },
      { version: "3.2.0", downloads: 80 },
      { version: "4.0.0", downloads: 20 },
    ],
  };
  const eolOf = (pkg: typeof eolPkg) =>
    computeInsights({ kind: "weekly-insight", packages: [pkg] }).find((i) =>
      i.id.startsWith("eol:"),
    );

  it("names the largest sunsetting old major + a concrete action, register-clean", () => {
    const eol = eolOf(eolPkg);
    expect(eol?.recommends).toBe(true);
    expect(eol?.text).toBe(
      "lib-x v3 is 8% of weekly downloads (v5 90%); plan v3 EOL",
    );
    expect(violatesRegister(eol!.text)).toBeNull();
  });

  it("does not fire without per-version data", () => {
    expect(computeInsights(PORT).some((i) => i.id.startsWith("eol:"))).toBe(
      false,
    );
  });

  it("does not fire with a single major (no migration story)", () => {
    expect(
      eolOf({
        ...eolPkg,
        versions: [
          { version: "5.0.1", downloads: 900 },
          { version: "5.0.0", downloads: 100 },
        ],
      }),
    ).toBeUndefined();
  });

  it("does not fire when the newest major fails to dominate", () => {
    expect(
      eolOf({
        ...eolPkg,
        versions: [
          { version: "5.0.0", downloads: 400 },
          { version: "4.0.0", downloads: 350 },
          { version: "3.0.0", downloads: 250 },
        ],
      }),
    ).toBeUndefined();
  });

  it("does not fire when the old major still holds a large share", () => {
    expect(
      eolOf({
        ...eolPkg,
        versions: [
          { version: "5.0.0", downloads: 600 },
          { version: "4.0.0", downloads: 400 },
        ],
      }),
    ).toBeUndefined();
  });

  it("ignores an already-dead old major (residual below the floor)", () => {
    expect(
      eolOf({
        ...eolPkg,
        versions: [
          { version: "5.0.0", downloads: 995 },
          { version: "3.0.0", downloads: 5 },
        ],
      }),
    ).toBeUndefined();
  });

  it("ignores low-volume packages (share would be noise)", () => {
    expect(
      eolOf({
        ...eolPkg,
        versions: [
          { version: "5.0.0", downloads: 40 },
          { version: "3.0.0", downloads: 8 },
        ],
      }),
    ).toBeUndefined();
  });
});

describe("selectInsights", () => {
  const mk = (
    id: string,
    salience: number,
    recommends = false,
  ): Insight => ({ id, salience, recommends, text: id });
  const pool = [
    mk("a", 0.9),
    mk("b", 0.8),
    mk("c", 0.7),
    mk("rec", 0.5, true),
  ];

  it("guarantees a recommendation when none made the top-N by salience", () => {
    const sel = selectInsights(pool, 3);
    expect(sel.map((i) => i.id)).toEqual(["a", "b", "rec"]);
  });

  it("leaves the top-N untouched when a recommendation is already in it", () => {
    const sel = selectInsights([mk("a", 0.9), mk("r", 0.85, true), mk("c", 0.7)], 3);
    expect(sel.map((i) => i.id)).toEqual(["a", "r", "c"]);
  });

  it("max=1 surfaces the recommendation as the single line (action-first)", () => {
    expect(selectInsights(pool, 1).map((i) => i.id)).toEqual(["rec"]);
  });

  it("returns everything when fewer candidates than max", () => {
    expect(selectInsights([mk("a", 0.9)], 3).map((i) => i.id)).toEqual(["a"]);
  });
});

describe("toStackItems / deterministic weekly stack", () => {
  it("maps selected insights to the cached {text, recommends} shape, lead first", () => {
    const stack = toStackItems(selectInsights(computeInsights(PORT), 3));
    expect(stack.length).toBeLessThanOrEqual(3);
    expect(stack[0].text).toBe(template(PORT)); // lead = top-salience computed insight
    expect(stack.some((s) => s.recommends)).toBe(true); // recommendation guaranteed in stack
    for (const s of stack) {
      expect(typeof s.text).toBe("string");
      expect(typeof s.recommends).toBe("boolean");
    }
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
