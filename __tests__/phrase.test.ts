import { describe, it, expect } from "vitest";
import { template, violatesRegister, phrase } from "@/lib/phrase";

describe("template (silent-proof)", () => {
  it("phrases downloads honestly, as counts not users", () => {
    expect(
      template({ kind: "silent-proof", downloads: 7305, packages: 16 }),
    ).toBe("7 305 downloads this week across 16 packages");
  });

  it("uses the singular noun for one package", () => {
    expect(template({ kind: "silent-proof", downloads: 5, packages: 1 })).toBe(
      "5 downloads this week across 1 package",
    );
  });

  it("renders zero honestly (no rounding-up, no flourish)", () => {
    expect(template({ kind: "silent-proof", downloads: 0, packages: 0 })).toBe(
      "0 downloads this week across 0 packages",
    );
  });

  it("is always register-clean", () => {
    expect(
      violatesRegister(
        template({ kind: "silent-proof", downloads: 120000, packages: 4 }),
      ),
    ).toBeNull();
  });
});

describe("violatesRegister", () => {
  it("flags 'people' — downloads are not people", () => {
    expect(violatesRegister("847 people downloaded your work")).toBe(
      "banned word: people",
    );
  });

  it("flags usage words (users, adoption)", () => {
    expect(violatesRegister("more users this week")).toBe("banned word: users");
    expect(violatesRegister("one user added")).toBe("banned word: user");
    expect(violatesRegister("real adoption is up")).toBe("banned word: adoption");
  });

  it("flags marketing words, em-dash, emoji, exclamation", () => {
    expect(violatesRegister("amazing growth this week")).toBe(
      "banned word: amazing",
    );
    expect(violatesRegister("7 305 downloads — nice")).toBe("em-dash");
    expect(violatesRegister("7 305 downloads 🚀")).toBe("emoji");
    expect(violatesRegister("7 305 downloads this week!")).toBe("exclamation");
  });

  it("passes a clean honest line", () => {
    expect(
      violatesRegister("7 305 downloads this week across 16 packages"),
    ).toBeNull();
  });
});

describe("phrase", () => {
  it("falls back to the template when no DEEPSEEK_API_KEY is set", async () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const facts = {
        kind: "silent-proof" as const,
        downloads: 7305,
        packages: 16,
      };
      expect(await phrase(facts)).toBe(template(facts));
    } finally {
      if (prev !== undefined) process.env.DEEPSEEK_API_KEY = prev;
    }
  });
});
