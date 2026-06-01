# 07 · Reality Check & Committed Spec

date: 2026-06-01
decision: user kept the **whole shortlist (4, 7, 11, 12)** and chose to proceed to
implementation. Phase 6 (naming) folded — these are in-product ephemeris surfaces, not
standalone npm packages needing registry/domain/social scans.

## Reality-check litmus (3 tests, per feature)

| feature | personal-use 5+/6mo | demo feasibility (public data) | 30-sec pitch | verdict |
|---|---|---|---|---|
| 12 silent-proof | ✅ checks/shares own impact | ✅ public npm counts | "honestly, how many pulled your work this week — and share it" | PASS |
| 7 maintained?/adoption | ✅ evaluates deps + own pkgs | ✅ public registry/repo | "a grounded 'is this maintained / are people upgrading' card — no opinion score" | PASS |
| 11 post-draft | ✅ posts weekly (LI/TG) | ✅ own real numbers | "drafts your weekly progress post from your real numbers, in your voice" | PASS |
| 4 version-migration | ✅ maintains versioned pkgs | ✅ public per-version dl | "see over time which versions users are actually on — when can you drop v3?" | PASS |

All four pass. No compliance issue (unlike AIDA/transportai — public data only).

## Non-negotiable constraints (carried from Phase 1/2 gates)

- **Grounded only.** AI phrases/packages REAL measured data. No "why", no chat, no opinion,
  no 0-100 score, no verdict, no persona/roast.
- **Honest-register copy.** Never "people"/"users"/"adoption" for download counts — say
  "downloads". Lowercase chrome, terse, no marketing words, no emoji, no em-dash (PRODUCT.md).
- **Blind A/B is a hard gate.** Every AI-phrased surface must beat a plain template in a blind
  judge before the AI variant ships. No measured edge → ship the template, drop the AI.
- **Cheap.** Pre-generate during the existing 6h sync + hard cache. No per-request LLM calls.
  Target $5–20/mo. (AIDA proved self-host is 10–20× pricier — use a cheap hosted model.)

## Shared infrastructure — **Step 0** (prerequisite for all AI features)

1. **`lib/phrase.ts`** — `phrase(kind, facts) → string`. A thin provider-agnostic interface
   over a cheap LLM (DeepSeek). Input = structured real metrics; output = one terse honest
   sentence. Always paired with `template(kind, facts)` — a deterministic plain-string
   fallback. Pure-function-testable (vitest, per repo TDD scope).
2. **Provider/env (the one real prerequisite).** Recommend **Vercel AI Gateway** with a
   `"deepseek/deepseek-..."` model string (fallbacks + observability + zero-retention, fits
   the Vercel stack) over a direct DeepSeek key. Needs one env var. **Blocker until provided.**
3. **Pre-gen + cache.** Generate phrasings inside `scripts/sync.ts` (6h cron) and store
   alongside the metrics; routes read cached strings only.
4. **Blind A/B harness** — `__tests__`/script that LLM-judges AI vs template phrasings on real
   samples; records the edge. Gate for every feature below.

## Build sequence (2–4 weeks part-time)

### Step 1 — **12 silent-proof** (first viral artifact)
Best viral × AI × funnel. Reuses the existing badge + `/u` pipeline.
- **v0.1 in:** weekly downloads summed across the maintainer's portfolio → one grounded line
  ("N downloads this week across M packages") on `/u/<login>` + a shareable card/badge
  variant carrying it; backlink = the profile (the connection funnel).
- **cut:** no "people"/persona/roast/emoji; no fabricated emotional claim; downloads ≠ users.
- **kill:** A/B shows no edge over template → ship template; or no share-driven connections in
  2 weeks of launch posts.

### Step 2 — **7 maintained? ⊕ 4 version-migration** (maintainer-flipped, fused)
The merge Phase 4 flagged: "how the ecosystem treats MY packages" — release cadence +
download trend + per-version download-share — honest facts, consumer-readable too. Rides the
PEAK supply-chain attention as the *inverse* (adoption-stale, not release-too-new) and the
surface Snyk Advisor is vacating (Jan-2026).
- **v0.1 in:** grounded fact card per package (last release Nd ago · dl trend · "v5 = 62% of
  downloads") on `/u` + per-package badge variant. **4's data layer already in flight
  (ephemeris-8lm)** — this is its AI/surface layer.
- **cut:** no 0-100 health score, no pass/fail verdict, no cooldown angle, no security scoring.
- **kill:** drowned by security-vendor framing at launch; or no traction after Maintainer-Month
  window.

### Step 3 — **11 post-draft** (ship last, hardest A/B)
Off the measurement mission + crowded build-in-public category; differentiation = honest npm
deltas + Sergei's plain voice. Most likely to fail the A/B gate (template may already suffice).
- **v0.1 in:** generate a ready-to-copy honest one-liner from real weekly momentum deltas, in
  plain non-marketer voice, with a `/u` backlink. Copy-to-clipboard, owner-only.
- **cut:** no auto-posting, no marketing voice, no literary devices/invented terms.
- **kill:** blind A/B vs a plain templated sentence shows no edge → drop the AI, keep nothing
  (a template the maintainer ignores isn't worth a surface).

## Cross-cutting kill criteria

- AI fails its blind A/B on a surface → that surface ships template-only or not at all.
- Inference cost trends past ~$20/mo despite pre-gen+cache → cut scope (fewer surfaces / longer
  cache TTL / owner-only).
- A register violation slips into copy (a "people"/"adoption"/verdict headline) → treat as a
  regression, not a tweak.

## Timing note

Off-season is the aligned window: **GitHub Maintainer Month = May** (already passed for 2026,
re-trigger May-2027), or ride the live supply-chain attention cycle for Step 2 — but keep
messaging on the maintainer-identity / honest-data angle, not the security news.

_Handoff: beads epic + tasks filed; first action = Step 0 (provider/env + lib/phrase + A/B
harness)._
