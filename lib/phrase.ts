import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { fmt } from "@/lib/format";

/**
 * Shared grounded-phrasing layer (oss-selection 2026-06-01, ephemeris-0cf).
 *
 * AI only PHRASES real measured metrics into one terse honest line — it never interprets,
 * guesses "why", or opines. Every kind ships with a deterministic {@link template} fallback,
 * and {@link phrase} degrades to that template whenever the model is unavailable or its output
 * breaks the honest register. Pre-generate during sync + cache; never call per request.
 *
 * The honest register is load-bearing (PRODUCT.md / DESIGN.md): download counts are CI + mirror
 * + bot heavy, so the copy says "downloads", never "people"/"users"/"adoption".
 */

export type PhraseKind = "silent-proof"; // more kinds added per feature step (zx6/6m2/0wc)

/** Weekly portfolio download total — Step 1 "silent-proof". Counts, not users. */
export interface SilentProofFacts {
  kind: "silent-proof";
  downloads: number; // summed across the maintainer's packages, trailing 7d (today-filtered)
  packages: number;
}

export type PhraseFacts = SilentProofFacts;

/** Deterministic honest-register phrasing. Always register-clean; the fallback for {@link phrase}. */
export function template(facts: PhraseFacts): string {
  switch (facts.kind) {
    case "silent-proof": {
      const noun = facts.packages === 1 ? "package" : "packages";
      return `${fmt(facts.downloads)} downloads this week across ${fmt(facts.packages)} ${noun}`;
    }
  }
}

// Words that would turn an honest count into a usage/marketing claim the register forbids.
const BANNED_WORDS = [
  "people", "user", "users", "adoption", "adopters", "audience",
  "amazing", "incredible", "awesome", "huge", "massive", "explosive", "skyrocket",
  "viral", "trending", "love", "loved", "best", "revolutionary", "unprecedented",
];
const EMOJI = /\p{Extended_Pictographic}/u;

/**
 * First honest-register violation in `text`, or null if clean. Mirrors the PRODUCT.md voice:
 * no usage/marketing words, no emoji, no exclamation, no em-dash.
 */
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

const SYSTEM: Record<PhraseKind, string> = {
  "silent-proof":
    "you phrase npm download metrics as ONE terse honest line, lowercase. " +
    "state only the given numbers. downloads are not users: never say 'people', " +
    "'users', or 'adoption'. no marketing words, no praise adjectives, no emoji, " +
    "no exclamation, no em-dash. at most 12 words.",
};

function userContent(facts: PhraseFacts): string {
  switch (facts.kind) {
    case "silent-proof":
      return `downloads this week: ${facts.downloads}; packages: ${facts.packages}`;
  }
}

/**
 * Grounded one-line phrasing of REAL metrics via a cheap LLM (DeepSeek). Degrades to
 * {@link template} when there is no `DEEPSEEK_API_KEY`, the call errors, or the output breaks
 * {@link violatesRegister}. Keep it pre-generated + cached (sync), never per request.
 */
export async function phrase(facts: PhraseFacts): Promise<string> {
  if (!process.env.DEEPSEEK_API_KEY) return template(facts);
  try {
    const { text } = await generateText({
      model: deepseek("deepseek-chat"),
      system: SYSTEM[facts.kind],
      prompt: userContent(facts),
      temperature: 0.4,
      maxOutputTokens: 60,
    });
    const line = text.trim().split("\n")[0].replace(/^["']|["']$/g, "").trim();
    if (!line || violatesRegister(line)) return template(facts);
    return line;
  } catch {
    return template(facts);
  }
}
