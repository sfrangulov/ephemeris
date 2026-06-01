# 02 · Asset Inventory & Condition Check

date: 2026-06-01
inputs: ephemeris `docs/research/2026-05-31-feature-opportunities-and-ai-lens.md`; sergei
promotion/viral canon + prior `oss-selection-2026-05-22/`; subagent mine (2026-06-01).

## Portfolio asset inventory

| Product | What it is | Metrics (npm last-mo @ ~2026-05) | Viral / cultural landing |
|---|---|---|---|
| **n8n-nodes-docx-to-md** | n8n node, docx → md | **30,765 DL/mo**, #1 for "docx to md" | ✅ the ONE organic traction engine ("флагман-тягач") |
| **skill-graveyard** | audits which CC skills actually fire | 1,748 DL/mo | niche; launch designed, not executed |
| **mcp-graveyard / memory-graveyard** | dead-MCP / memory audits | 532 / 400 DL/mo | niche; self-flagged "publish-bot-padded" |
| **npm-pets** | renders an npm author's portfolio as a "pet" card (SVG/PNG 1200×630) | 716 DL/mo | **closest analog to an ephemeris shareable artifact**; design-explored, not launched |
| **penwick** | narrative fun-util (no fuller description on record) | 205 DL/mo | niche |
| **ephemeris.tools** | npm-portfolio observatory (this product) | — | the surface we're adding to |
| **AIDA / ai-data-analyst** | self-hosted AI Data Analyst SaaS (transportai.kz, DeepSeek V4 Flash) | client product, not a brand asset | n/a — **only lesson: self-host LLM is 10–20× pricier than hosted API** |

Brand-context caveats (sergei memories): the Telegram channel has **botted subscribers** —
never cite as social proof. Stars are treated as **purchasable vanity**; real signals are
ref-traffic, adoption, incoming connections.

## Two prior verdicts that GATE this decision

**A. ephemeris AI-lens (2026-05-31, adversarially tested) — "AI is not the killer feature."**
Evaluated honestly, every AI feature is either off-mission or commoditized for an *honest
instrument*. Explicit Tier-3 do-not-builds:
- AI "why did downloads spike/drop" → **register violation** (even Honeycomb calls anomaly
  narration "a misapplication of AI"); ephemeris holds the count, never the cause.
- Chat / NL copilot over the portfolio → the "purple-gradient AI aesthetic" the product
  anti-references; "data IS the marketing" already.
- The only AI that survives the register = grounded, uncertainty-flagged release-notes — but
  it's *authoring* (off-mission) and GitHub ships it natively (commoditized).

**B. sergei viral/promotion canon + npm-pets design + post-mortems.**
- **caveman-ru** (a "clever terse output" feature) was **built and killed** after a blind A/B
  showed no real edge → *prove the AI adds value with a blind A/B before shipping it as a
  differentiator.*
- **npm-pets** adversarial verdicts: refuted gradient-string ("GHRS hits 30k★ on clean
  typography"), refuted Twitter-intent share CTA (friction); warned "cuteness cascade" (don't
  stack effects) and "data-leaking pair" (embed URL + social share leak viewer metadata).
- **Voice gate:** copy Sergei posts personally = plain non-native-dev English, frozen
  numbers, no literary devices / invented jargon / marketing adjectives.

## OP-CONDITIONS — then-vs-now (viral lens)

The only measured *organic* win is docx-to-md (30k/mo). Conditions that drive Sergei's
viral/launch plays, and whether they still hold:

| Condition | Why it worked | Holds mid-2026? |
|---|---|---|
| Exact-match task naming | name == task query (86× lift example) | ✅ strengthened (agent-mediated discovery) |
| Distribution > production | identical idea/code; virality = packaging + posting | ✅ holds (cheap, durable) |
| Problem-first / data-finding narrative, non-marketer voice | HN punishes naked self-promo, rewards a real number | ✅ holds |
| Reproducible CTA replaces star-begging | "run it on your own data, reply with your number" | ✅ holds |
| Copy-paste embed drives the loop | GHRS/freellmapi virality built on one README line | ✅ holds, **gated** (host must resolve + privacy caveat) |
| HN front-page, engineered not gambled | posting hour worth hundreds of stars | ✅ holds (high variance) |
| Instrument adoption, not stars | stars = purchasable vanity | ✅ holds |
| **AI as an interpretive feature** | — | ❌ **does NOT transfer** — collides with the honest register (verdict A) |

## Transferability verdict: **MEDIUM**

The *viral playbook* transfers cleanly. The *AI angle* transfers only in a **constrained
form**. This is the load-bearing finding:

> **AI as honest phrasing/packaging of REAL measured data → OK. AI that interprets / explains
> / guesses / chats → off-register and against a fresh adversarial verdict.**

## The central tension to resolve at the gate

The request's theme — "deep repo analysis, find раскрутки / virality / marketing / hype" —
is **interpretive AI**, exactly what verdict A warns against on the honest-instrument core.
Resolution options carried into the Phase 2 gate (this choice constrains all Phase 3 ideas):

- **Grounded** — AI only phrases/packages real ephemeris metrics into a shareable artifact;
  no "why"/chat/opinion. Keeps the register. Less of the "hype detection" the request named.
- **Fenced fun sub-brand** — interpretive AI (roast / hype-meter), but a deliberately
  separate playful surface outside the honest instrument. Delivers the theme; brand-dilution
  risk + the anti-referenced AI aesthetic.
- **Hybrid** — grounded core artifact + one small optional playful gesture.

**Gate resolution (2026-06-01, confirmed):**
- **Grounded chosen.** Every Phase 3 idea must use AI *only* to phrase/package REAL measured
  ephemeris data into a shareable artifact. No "why", no chat, no opinion, no LLM-judged
  "hype/virality" verdicts. The request's "hype/marketing/virality analysis" is admitted only
  as honest derived metrics (real deltas, real version-share), never as model interpretation.
- **Blind A/B is a mandatory gate** (caveman-ru precedent): before AI phrasing ships as a
  differentiator, blind-judge it against a plain templated string. No measured edge → no AI.
- Conditions verdict: viral playbook transfers (✅); interpretive-AI does not (❌). Phase 3
  ideation is bounded accordingly.
