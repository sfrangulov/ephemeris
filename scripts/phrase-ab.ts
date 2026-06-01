/**
 * Blind A/B gate for the grounded-phrasing layer (oss-selection 2026-06-01, ephemeris-0cf).
 *
 * The mandatory gate from 07-spec: AI phrasing ships ONLY if it beats the deterministic
 * template in a blind judgement. No measured edge -> ship the template, drop the AI (the
 * caveman-ru precedent). Run when a key is present:
 *
 *   set -a; . ./.env.local; set +a; npx tsx scripts/phrase-ab.ts
 *
 * Requires DEEPSEEK_API_KEY. Judge order is randomized per sample so position can't bias it.
 */
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { phrase, template, type PhraseFacts } from "../lib/phrase";

// Real-shaped samples (sfrangulov portfolio order of magnitude). Extend per kind as features land.
const SAMPLES: PhraseFacts[] = [
  { kind: "silent-proof", downloads: 7305, packages: 16 },
  { kind: "silent-proof", downloads: 33, packages: 16 },
  { kind: "silent-proof", downloads: 120_000, packages: 4 },
  { kind: "silent-proof", downloads: 0, packages: 2 },
];

const JUDGE_SYSTEM =
  "you judge two one-line phrasings of the same npm download metric. pick the line that is " +
  "more honest and readable for a terse, lowercase, no-marketing npm tool. downloads are not " +
  "users: penalize any line implying people/users/adoption, any marketing word, emoji, " +
  "exclamation, or em-dash. reply with exactly one token: A, B, or TIE.";

async function judge(line1: string, line2: string): Promise<"1" | "2" | "tie"> {
  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system: JUDGE_SYSTEM,
    prompt: `A: ${line1}\nB: ${line2}`,
    temperature: 0,
    maxOutputTokens: 4,
  });
  const v = text.trim().toUpperCase();
  if (v.startsWith("A")) return "1";
  if (v.startsWith("B")) return "2";
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
      // model fell back (no edge possible) — count as a tie.
      ties++;
      console.log(`tie (fallback): ${tpl}`);
      continue;
    }
    const aiFirst = Math.random() < 0.5;
    const winner = await judge(aiFirst ? ai : tpl, aiFirst ? tpl : ai);
    const aiWon =
      (winner === "1" && aiFirst) || (winner === "2" && !aiFirst);
    const tplWon =
      (winner === "1" && !aiFirst) || (winner === "2" && aiFirst);
    if (winner === "tie") ties++;
    else if (aiWon) aiWins++;
    else if (tplWon) tplWins++;
    console.log(
      `${winner === "tie" ? "tie " : aiWon ? "AI  " : "tpl "}| ai="${ai}" tpl="${tpl}"`,
    );
  }

  const n = SAMPLES.length;
  console.log(`\nAI ${aiWins} / template ${tplWins} / tie ${ties} (n=${n})`);
  // Gate: AI must beat the template on a strict majority to ship the AI variant.
  const ships = aiWins > tplWins && aiWins > n / 2;
  console.log(
    ships
      ? "GATE PASS: AI phrasing beats the template — ship the AI variant."
      : "GATE FAIL: no clear AI edge — ship the deterministic template.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
