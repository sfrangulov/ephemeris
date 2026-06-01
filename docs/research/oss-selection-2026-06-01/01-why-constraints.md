# 01 · Why & Constraints — ephemeris.tools AI feature selection

date: 2026-06-01
status: **LOCKED** (Phase 1 gate passed)

## Brand goal — what "winning" looks like

**Viral moment.** The AI feature must produce a shareable artifact (screenshottable /
auto-postable) that creates a launch spike — lifting stars / traffic / followers across
Sergei's whole tool portfolio and funneling attention into ephemeris.tools.

Locked implication: to drive the success metric (connections), the artifact must work for
*other people's* profiles **without their participation** — otherwise there's nothing to
bait new maintainers with. This shapes Phase 3 ideation.

## Hard constraints (become kill criteria in Phase 7)

- **AI inference budget: $5–20/mo.** ⇒ pre-generate for all public profiles + hard cache;
  no expensive per-request LLM calls. DeepSeek is the default cheap engine ("DeepSeek" read
  as "cheap LLM inference", not a hard vendor lock).
- **Build budget: 2–4 weeks part-time.** A visible sub-product with its own landing / launch
  is allowed, not only a small in-app widget.
- **Brand voice (PRODUCT.md): technical, terse, lowercase chrome, no marketing words, no
  hype, no emoji, no em-dashes.** Paradox to manage: the *theme* (hype / virality /
  marketing) is exactly the register the voice forbids. The feature must render its findings
  in the honest, terse tone. Load-bearing constraint + likely anti-reference.

## Success criteria (measurable, brand-aligned)

- **Primary: 50 maintainers connect their ephemeris profile within 6 weeks of launch.**
- Secondary (vehicle, not metric): ≥1 launch post / thread reaching 50k+ impressions
  mentioning ephemeris.

## Given inputs (from the request, treated as scope)

- Surface: ephemeris.tools (npm-portfolio observatory).
- Theme space: profile analytics · deep repo analysis · promotion (раскрутка) detection ·
  virality · marketing · hype.
- Engine: DeepSeek-class cheap inference.
