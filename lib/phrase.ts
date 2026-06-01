import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { fmt } from "@/lib/format";

/**
 * Grounded INSIGHT + RECOMMENDATION layer (oss-selection 2026-06-01, ephemeris-0cf).
 *
 * Architecture: **compute → select → phrase.** Candidate insights are computed
 * deterministically from REAL metrics ({@link computeInsights}) — so every number is honest
 * and verifiable. The LLM only *selects* the most noteworthy candidate and *phrases* it as a
 * terse insight (optionally one recommendation clause); it can never invent a number — the
 * {@link ungroundedNumbers} guard rejects any digit not present in the candidates, and
 * {@link phrase} then degrades to {@link template} (the top-salience computed insight).
 *
 * This is the amended Phase-2 gate: not "phrase the fact" (a number already on screen adds
 * nothing) but "surface the non-obvious + recommend the next action" — kept honest by
 * construction. Still banned: external-cause speculation, usage claims (downloads != users),
 * hype verdicts, marketing voice (PRODUCT.md). Pre-generate during sync + cache.
 */

export type PhraseKind = "weekly-insight";

export interface PackageStat {
  name: string;
  downloads: number; // trailing 7d (today-filtered)
  prevDownloads: number; // prior 7d
  lastPublishDays: number | null; // days since last publish; null if unknown
}

export interface WeeklyInsightFacts {
  kind: "weekly-insight";
  packages: PackageStat[];
}

export type PhraseFacts = WeeklyInsightFacts;

export interface Insight {
  id: string;
  text: string; // honest, computed, register-clean
  salience: number; // 0..1, higher = more noteworthy
  recommends: boolean;
}

const ARCHIVE_MAX_DL = 5;
const ARCHIVE_MIN_AGE = 90;

const pct = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

/** The honest noise floor already used across ephemeris: 5% AND sqrt(prev) AND prev >= 20. */
const isRealMove = (d: number, prev: number): boolean =>
  prev >= 20 && Math.abs(d - prev) > Math.max(prev * 0.05, Math.sqrt(prev));

/**
 * Deterministic, honest candidate insights from real per-package stats, ranked by salience.
 * Every entry is a computed fact (and the highest-salience one is also the {@link template}
 * fallback). The LLM picks among these — it does not produce numbers of its own.
 */
export function computeInsights(facts: WeeklyInsightFacts): Insight[] {
  const pkgs = facts.packages;
  const out: Insight[] = [];
  const total = pkgs.reduce((s, p) => s + p.downloads, 0);
  const n = pkgs.length;

  // concentration — is the portfolio carried by one package?
  if (total > 0 && n > 1) {
    const top = [...pkgs].sort((a, b) => b.downloads - a.downloads)[0];
    const share = pct(top.downloads, total);
    if (share >= 50) {
      out.push({
        id: "concentration",
        salience: share / 100,
        text: `${top.name} is ${share}% of your ${fmt(total)} weekly downloads`,
        recommends: false,
      });
    }
  }

  // biggest real movers (noise-gated)
  const moves = pkgs
    .filter((p) => isRealMove(p.downloads, p.prevDownloads))
    .map((p) => ({ p, change: pct(p.downloads - p.prevDownloads, p.prevDownloads) }));
  const up = moves.filter((m) => m.change > 0).sort((a, b) => b.change - a.change)[0];
  const dn = moves.filter((m) => m.change < 0).sort((a, b) => a.change - b.change)[0];
  if (up)
    out.push({
      id: "up",
      salience: Math.min(0.95, up.change / 100),
      text: `${up.p.name} downloads +${up.change}% w/w`,
      recommends: false,
    });
  if (dn)
    out.push({
      id: "down",
      salience: Math.min(0.95, Math.abs(dn.change) / 100),
      text: `${dn.p.name} downloads ${dn.change}% w/w`,
      recommends: false,
    });

  // archive candidates — stale AND barely downloaded (a real recommendation)
  const stale = pkgs.filter(
    (p) =>
      p.lastPublishDays != null &&
      p.lastPublishDays >= ARCHIVE_MIN_AGE &&
      p.downloads < ARCHIVE_MAX_DL,
  );
  if (stale.length > 0) {
    const noun = stale.length === 1 ? "package" : "packages";
    out.push({
      id: "archive",
      salience: Math.min(0.9, 0.4 + stale.length * 0.1),
      text: `${fmt(stale.length)} ${noun} under ${ARCHIVE_MAX_DL} downloads/week and not published in ${ARCHIVE_MIN_AGE}+ days; archive candidates`,
      recommends: true,
    });
  }

  // baseline total — low-salience fallback so there is always at least one line
  const noun = n === 1 ? "package" : "packages";
  out.push({
    id: "total",
    salience: 0.1,
    text: `${fmt(total)} downloads this week across ${fmt(n)} ${noun}`,
    recommends: false,
  });

  return out.sort((a, b) => b.salience - a.salience);
}

/** Deterministic phrasing = the single most salient computed insight. Fallback for {@link phrase}. */
export function template(facts: PhraseFacts): string {
  return computeInsights(facts)[0].text;
}

// Words that would turn an honest count into a usage/marketing claim the register forbids.
const BANNED_WORDS = [
  "people", "user", "users", "adoption", "adopters", "audience",
  "amazing", "incredible", "awesome", "huge", "massive", "explosive", "skyrocket",
  "viral", "trending", "love", "loved", "best", "revolutionary", "unprecedented",
];
const EMOJI = /\p{Extended_Pictographic}/u;

/** First honest-register violation in `text`, or null if clean (PRODUCT.md voice). */
export function violatesRegister(text: string): string | null {
  const lower = text.toLowerCase();
  for (const w of BANNED_WORDS) {
    if (new RegExp(`\\b${w}\\b`).test(lower)) return `banned word: ${w}`;
  }
  if (text.includes("—")) return "em-dash";
  if (text.includes("!")) return "exclamation";
  if (EMOJI.test(text)) return "emoji";
  return null;
}

/** Digit-groups in `s`, with intra-number grouping spaces collapsed ("7 305" -> "7305"). */
function numbersIn(s: string): Set<string> {
  const joined = s.replace(/(?<=\d)[  ](?=\d)/g, "");
  return new Set(joined.match(/\d+/g) ?? []);
}

/** Numbers in `text` not present in `allowed` — the anti-hallucination grounding guard. */
export function ungroundedNumbers(text: string, allowed: Set<string>): string[] {
  return [...numbersIn(text)].filter((x) => !allowed.has(x));
}

const SYSTEM =
  "you are a terse, honest npm-portfolio analyst. you are given several TRUE computed insights " +
  "about a maintainer's week. pick the SINGLE most noteworthy one and write it as one terse, " +
  "lowercase line; you may add at most one short recommendation clause if a candidate already " +
  "implies an action. rules: use ONLY numbers that appear in the candidates — never invent or " +
  "recompute a number. do not speculate about causes. downloads are not users: never say " +
  "people, users, or adoption. no marketing words, no emoji, no exclamation, no em-dash. " +
  "at most 16 words.";

/**
 * Grounded insight via a cheap LLM (DeepSeek): selects + phrases the most noteworthy computed
 * insight. Degrades to {@link template} when there is no `DEEPSEEK_API_KEY`, the call errors,
 * the output breaks {@link violatesRegister}, or it contains an ungrounded number. Keep it
 * pre-generated + cached (sync), never per request.
 */
export async function phrase(facts: PhraseFacts): Promise<string> {
  const candidates = computeInsights(facts);
  const fallback = candidates[0].text;
  if (!process.env.DEEPSEEK_API_KEY) return fallback;
  const allowed = numbersIn(candidates.map((c) => c.text).join(" "));
  try {
    const { text } = await generateText({
      model: deepseek("deepseek-chat"),
      system: SYSTEM,
      prompt: "candidate insights:\n" + candidates.map((c) => `- ${c.text}`).join("\n"),
      temperature: 0.3,
      maxOutputTokens: 80,
    });
    const line = text
      .trim()
      .split("\n")[0]
      .replace(/^["'\s-]+|["']+$/g, "")
      .trim();
    if (
      !line ||
      violatesRegister(line) ||
      ungroundedNumbers(line, allowed).length > 0
    ) {
      return fallback;
    }
    return line;
  } catch {
    return fallback;
  }
}
