/**
 * Blind A/B gate for the grounded insight layer (oss-selection 2026-06-01, ephemeris-0cf).
 *
 * AI phrasing ships ONLY if it beats the deterministic template (the top-salience computed
 * insight) in a blind judgement of which is the more USEFUL + honest weekly insight. No edge
 * -> ship the template (caveman-ru precedent). The AI's lever is *selection* (which computed
 * insight matters most) + a natural recommendation clause — never new numbers. Run:
 *
 *   set -a; . ./.env.local; set +a; npx tsx scripts/phrase-ab.ts
 *
 * Requires DEEPSEEK_API_KEY. Judge order is randomized per sample so position can't bias it.
 */
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { phrase, template, type WeeklyInsightFacts } from "../lib/phrase";

// Real-shaped portfolios. Varied so the AI's *selection* can differ from raw top-salience.
const SAMPLES: WeeklyInsightFacts[] = [
  {
    // concentration dominates, but a stale-archive recommendation may be more actionable
    kind: "weekly-insight",
    packages: [
      { name: "docx-to-md", downloads: 7000, prevDownloads: 6000, lastPublishDays: 5 },
      { name: "skill-graveyard", downloads: 200, prevDownloads: 100, lastPublishDays: 10 },
      { name: "old-thing", downloads: 1, prevDownloads: 1, lastPublishDays: 140 },
      { name: "dead-thing", downloads: 2, prevDownloads: 3, lastPublishDays: 200 },
    ],
  },
  {
    // a clear mover, no concentration
    kind: "weekly-insight",
    packages: [
      { name: "url-to-md", downloads: 900, prevDownloads: 400, lastPublishDays: 12 },
      { name: "npm-pets", downloads: 700, prevDownloads: 720, lastPublishDays: 30 },
      { name: "penwick", downloads: 650, prevDownloads: 640, lastPublishDays: 25 },
    ],
  },
  {
    // recommendation-heavy: several archive candidates
    kind: "weekly-insight",
    packages: [
      { name: "mcp-graveyard", downloads: 500, prevDownloads: 480, lastPublishDays: 8 },
      { name: "a", downloads: 1, prevDownloads: 1, lastPublishDays: 100 },
      { name: "b", downloads: 0, prevDownloads: 2, lastPublishDays: 130 },
      { name: "c", downloads: 3, prevDownloads: 3, lastPublishDays: 95 },
    ],
  },
  {
    // flat week: only the total baseline
    kind: "weekly-insight",
    packages: [
      { name: "x", downloads: 40, prevDownloads: 41, lastPublishDays: 14 },
      { name: "y", downloads: 30, prevDownloads: 29, lastPublishDays: 20 },
    ],
  },
];

const JUDGE_SYSTEM =
  "you judge two one-line weekly insights about the SAME npm portfolio. pick the one a " +
  "maintainer would find more useful: surfaces the more noteworthy fact or a sound actionable " +
  "recommendation, while staying honest, terse, lowercase, and grounded (no invented numbers, " +
  "no cause speculation, downloads != users, no marketing). reply with exactly one token: " +
  "A, B, or TIE.";

async function judge(a: string, b: string): Promise<"A" | "B" | "tie"> {
  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system: JUDGE_SYSTEM,
    prompt: `A: ${a}\nB: ${b}`,
    temperature: 0,
    maxOutputTokens: 4,
  });
  const v = text.trim().toUpperCase();
  if (v.startsWith("A")) return "A";
  if (v.startsWith("B")) return "B";
  return "tie";
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY not set — cannot run the live A/B gate.");
    process.exit(1);
  }
  let aiWins = 0;
  let tplWins = 0;
  let ties = 0;

  for (const facts of SAMPLES) {
    const ai = await phrase(facts);
    const tpl = template(facts);
    if (ai === tpl) {
      ties++;
      console.log(`tie (fallback): ${tpl}`);
      continue;
    }
    const aiIsA = Math.random() < 0.5;
    const verdict = await judge(aiIsA ? ai : tpl, aiIsA ? tpl : ai);
    const aiWon = (verdict === "A" && aiIsA) || (verdict === "B" && !aiIsA);
    const tplWon = (verdict === "A" && !aiIsA) || (verdict === "B" && aiIsA);
    if (verdict === "tie") ties++;
    else if (aiWon) aiWins++;
    else if (tplWon) tplWins++;
    const tag = verdict === "tie" ? "tie" : aiWon ? "AI " : "tpl";
    console.log(`${tag} | ai: ${ai}\n      tpl: ${tpl}`);
  }

  const n = SAMPLES.length;
  console.log(`\nAI ${aiWins} / template ${tplWins} / tie ${ties} (n=${n})`);
  const ships = aiWins > tplWins && aiWins > n / 2;
  console.log(
    ships
      ? "GATE PASS: AI insight beats the template — ship the AI variant."
      : "GATE FAIL: no clear AI edge — ship the deterministic template.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
