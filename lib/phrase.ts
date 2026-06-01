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

/** One stable version's download count in the latest npm last-week window. */
export interface VersionDownload {
  version: string; // stable semver, e.g. "5.2.1"
  downloads: number;
}

export interface PackageStat {
  name: string;
  downloads: number; // trailing 7d (today-filtered)
  prevDownloads: number; // prior 7d
  lastPublishDays: number | null; // days since last publish; null if unknown
  /** Per-version stable downloads for the latest npm last-week window, used by
   *  the version-EOL rule. Absent/empty => no EOL insight for this package. */
  versions?: VersionDownload[];
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

/** One line of the rendered insight stack (cached, surfaced on /u). */
export interface InsightStackItem {
  text: string;
  recommends: boolean;
}

/** Pre-generated, cached weekly-insight payload stored on `profiles`. */
export interface WeeklyInsightPayload {
  stack: InsightStackItem[]; // ordered, lead first
  generated_at: string; // ISO timestamp of the sync that produced it
}

/** Wrap per-package stats into weekly-insight facts. */
export function toFacts(packages: PackageStat[]): WeeklyInsightFacts {
  return { kind: "weekly-insight", packages };
}

const ARCHIVE_MAX_DL = 5;
const ARCHIVE_MIN_AGE = 90;

// version-EOL rule: an OLD major that has shrunk to <= EOL_SHARE_MAX% of a
// package's weekly version-downloads, while a NEWER major now carries the
// majority, is a safe end-of-life candidate. Gated so the call is meaningful:
// the package needs EOL_MIN_TOTAL weekly version-downloads (else share is
// noise), the old major needs a real residual tail (EOL_MIN_OLD, not ~0 — that
// is already-dead, not "plan EOL"), and the newest major must clearly dominate.
const EOL_SHARE_MAX = 15; // %
const EOL_MIN_TOTAL = 100; // weekly version-downloads for the share to mean anything
const EOL_MIN_OLD = 10; // residual downloads on the old major (a real tail)
const EOL_NEW_DOMINANCE = 50; // % the newest major must hold for EOL to be clear-cut

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

  // concentration — show the CONTRAST (other N sum to X) so it explains itself,
  // instead of a vague "diversify" verb.
  if (total > 0 && n > 1) {
    const top = [...pkgs].sort((a, b) => b.downloads - a.downloads)[0];
    const share = pct(top.downloads, total);
    if (share >= 50) {
      const rest = total - top.downloads;
      out.push({
        id: "concentration",
        salience: share / 100,
        text: `${top.name} is ${share}% of your ${fmt(total)} weekly downloads; the other ${fmt(n - 1)} sum to ${fmt(rest)}`,
        recommends: false,
      });
    }
  }

  // biggest real movers (noise-gated) — show prev→now so the move is legible.
  const moves = pkgs
    .filter((p) => isRealMove(p.downloads, p.prevDownloads))
    .map((p) => ({ p, change: pct(p.downloads - p.prevDownloads, p.prevDownloads) }));
  const up = moves.filter((m) => m.change > 0).sort((a, b) => b.change - a.change)[0];
  const dn = moves.filter((m) => m.change < 0).sort((a, b) => a.change - b.change)[0];
  if (up)
    out.push({
      id: "up",
      salience: Math.min(0.9, up.change / 100),
      text: `${up.p.name} ${fmt(up.p.prevDownloads)}→${fmt(up.p.downloads)} dl/wk (+${up.change}%)`,
      recommends: false,
    });
  if (dn)
    out.push({
      id: "down",
      salience: Math.min(0.9, Math.abs(dn.change) / 100),
      text: `${dn.p.name} ${fmt(dn.p.prevDownloads)}→${fmt(dn.p.downloads)} dl/wk (${dn.change}%)`,
      recommends: false,
    });

  // broad decline — a detailed aggregate when many packages fall at once.
  const bigDrops = moves.filter((m) => m.change <= -50);
  if (bigDrops.length >= 3) {
    out.push({
      id: "broad-down",
      salience: Math.min(0.85, 0.45 + bigDrops.length * 0.05),
      text: `${fmt(bigDrops.length)} packages down 50%+ w/w`,
      recommends: false,
    });
  }

  // archive candidates — NAME them + a concrete action, not a vague nudge.
  const stale = pkgs.filter(
    (p) =>
      p.lastPublishDays != null &&
      p.lastPublishDays >= ARCHIVE_MIN_AGE &&
      p.downloads < ARCHIVE_MAX_DL,
  );
  if (stale.length > 0) {
    const names = stale.slice(0, 3).map((p) => p.name).join(", ");
    const more = stale.length > 3 ? ` and ${fmt(stale.length - 3)} more` : "";
    out.push({
      id: "archive",
      salience: Math.min(0.9, 0.4 + stale.length * 0.1),
      text: `${names}${more}: under ${ARCHIVE_MAX_DL} dl/wk and ${ARCHIVE_MIN_AGE}+ days stale; deprecate or archive`,
      recommends: true,
    });
  }

  // version-EOL candidates — NAME the old major + its share + a concrete action
  // ("plan v3 EOL"), rule-anchored (not a free hunch). One per qualifying pkg.
  for (const p of pkgs) {
    const eol = eolInsight(p);
    if (eol) out.push(eol);
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

/** Leading-integer major of a stable semver ("5.2.1" -> 5); null if unparseable. */
function majorOf(version: string): number | null {
  const m = /^\s*(\d+)/.exec(version);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * The version-EOL insight for one package, or null if it does not qualify. Fires
 * when an old major has shrunk to <= {@link EOL_SHARE_MAX}% of weekly
 * version-downloads while the newest major holds the majority — a safe
 * end-of-life candidate. All thresholds are noise gates (see the EOL_* consts):
 * downloads are reported honestly (never "users").
 */
function eolInsight(p: PackageStat): Insight | null {
  const versions = p.versions ?? [];
  if (versions.length === 0) return null;
  const total = versions.reduce((s, v) => s + v.downloads, 0);
  if (total < EOL_MIN_TOTAL) return null;

  const byMajor = new Map<number, number>();
  for (const v of versions) {
    const maj = majorOf(v.version);
    if (maj == null) continue;
    byMajor.set(maj, (byMajor.get(maj) ?? 0) + v.downloads);
  }
  if (byMajor.size < 2) return null; // no migration story without >=2 majors

  const newMajor = Math.max(...byMajor.keys());
  const newShare = pct(byMajor.get(newMajor) ?? 0, total);
  if (newShare < EOL_NEW_DOMINANCE) return null; // newest major must dominate

  // the largest old major that has shrunk below the threshold — the biggest
  // sunsetting candidate worth naming.
  let candidate: { major: number; dl: number } | null = null;
  for (const [maj, dl] of byMajor) {
    if (maj >= newMajor) continue;
    if (dl < EOL_MIN_OLD) continue; // ~0 => already dead, not "plan EOL"
    if (pct(dl, total) > EOL_SHARE_MAX) continue;
    if (!candidate || dl > candidate.dl) candidate = { major: maj, dl };
  }
  if (!candidate) return null;

  const oldShare = pct(candidate.dl, total);
  return {
    id: `eol:${p.name}`,
    salience: Math.min(0.75, 0.4 + newShare / 200),
    text: `${p.name} v${candidate.major} is ${oldShare}% of weekly downloads (v${newMajor} ${newShare}%); plan v${candidate.major} EOL`,
    recommends: true,
  };
}

/**
 * Deterministic top-`max` selection for the surface stack, ordered by salience
 * (lead = most noteworthy). Guarantees >=1 recommendation is present when any
 * candidate recommends: if none of the top-`max` recommend, the highest-salience
 * recommendation replaces the weakest selected descriptive insight.
 */
export function selectInsights(candidates: Insight[], max = 3): Insight[] {
  const sorted = [...candidates].sort((a, b) => b.salience - a.salience);
  const picked = sorted.slice(0, max);
  if (picked.some((i) => i.recommends)) return picked;
  const rec = sorted.find((i) => i.recommends);
  if (!rec) return picked;
  return [...picked.slice(0, -1), rec].sort((a, b) => b.salience - a.salience);
}

/** Map selected insights to the cached stack shape (ordered, lead first). */
export function toStackItems(insights: Insight[]): InsightStackItem[] {
  return insights.map((i) => ({ text: i.text, recommends: i.recommends }));
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
// Empty business-speak verbs: a recommendation must be concrete (a named action or number),
// not a vague nudge like "diversify". These force a fallback to the detailed computed insight.
const VAGUE_ADVICE = [
  "diversify", "optimize", "leverage", "monetize", "synergize", "engage", "improve",
];

/** First honest-register violation in `text`, or null if clean (PRODUCT.md voice). */
export function violatesRegister(text: string): string | null {
  const lower = text.toLowerCase();
  for (const w of BANNED_WORDS) {
    if (new RegExp(`\\b${w}\\b`).test(lower)) return `banned word: ${w}`;
  }
  for (const w of VAGUE_ADVICE) {
    if (new RegExp(`\\b${w}\\b`).test(lower)) return `vague advice: ${w}`;
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
  "lowercase line, keeping its concrete numbers and named action. rules: use ONLY numbers that " +
  "appear in the candidates — never invent or recompute. do NOT add vague advice (no bare " +
  "'diversify', 'optimize', 'improve'); a recommendation is allowed only if it names a concrete " +
  "action already in a candidate (e.g. 'deprecate or archive', 'plan v3 EOL'). do not speculate " +
  "about causes. downloads are not users: never say people, users, or adoption. no marketing " +
  "words, no emoji, no exclamation, no em-dash. at most 18 words.";

/**
 * Single grounded insight line via a cheap LLM (DeepSeek): selects + phrases the
 * most noteworthy computed insight. Degrades to {@link template} when there is
 * no `DEEPSEEK_API_KEY`, the call errors, the output breaks
 * {@link violatesRegister}, or it contains an ungrounded number.
 *
 * NOTE: the blind A/B gate found NO edge over {@link template} for single-line
 * phrasing (the model either reproduces the top candidate verbatim — equal to
 * the template — or rephrases it into something the judge rates no better). So
 * the /u weekly-insight stack ships the DETERMINISTIC {@link selectInsights}
 * output, not this. `phrase` is kept for the A/B harness and a future
 * single-line surface (Step 3 post-draft) where selection genuinely matters.
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
