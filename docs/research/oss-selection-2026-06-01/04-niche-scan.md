# 04 · Niche / Platform / Pain / Hype Scan

date: 2026-06-01
method: 16-agent parallel workflow (OP-NICHE×6 + OP-PAIN×6 + OP-PLATFORM×2 + OP-HYPE×2),
strict schemas. Web-sourced; Reddit/X partially unsearchable (noted per agent).

## Saturation matrix

| # | option | niche (verdict) | top competitor | pain (verdict) | platform risk | hype | funnel→connections | call |
|---|---|---|---|---|---|---|---|---|
| 4 | version-migration | 1 · **clear** | scttcper/version-adoption — **DEAD** (2★, archived Dec-2025) | 3 · weak grassroots / **top-maintainer validated** (Erikson near-verbatim) | **low** (npm declined for 5y) | inverse of PEAK "cooldown" wave = **open**; ephemeris already captures (ephemeris-8lm) | direct + **unique data moat** | ✅ survive |
| 7 | maintained? | 2 · **clear** | mnapoli/IsItMaintained — dead 2019; **Snyk Advisor sunsetting Jan-2026** | **4 · validated** (AI-era intensified; Aqua 21.2%/2.1B dl) | **low** | category **PEAK** (supply-chain); inverse "adoption stale" open; card surface vacated | indirect (consumer→"track your own") but **widest reach** | ✅ survive |
| 12 | silent-proof | 2 · **clear** | vercel-labs/npm.bet (comparison) | 3 · **validated** (strong counter-signal) | low | proof-of-impact emotional hook **unoccupied** | direct, strong emotional funnel | ✅ survive |
| 11 | post-draft | 2 · **clear** (honest variant) | opentweet.io (closed, paid, interprets) | 3 · **validated** (marketing-aversion) | low | build-in-public crowded; honest-numbers + npm-delta draft unoccupied | direct | ✅ survive |
| 3 | wrapped | 2 · crowded | basicutils NpmStars / GitHub-wrapped swarm | 3 · **weak** (proud-badge abandoned) | low | **POST-WAVE, Dec-locked**; npm-data wrapped = HN graveyard | direct | ❌ **eliminate** |
| 9 | npx-card | 2 · clear combo | anuraghazra/github-readme-stats (79k, GitHub-only) | **2 · weak** (active counter-signals) | low | npm-stats Show HN graveyard (1–2 pts) | direct, but **ephemeris already ships the validated embed** | ❌ **eliminate** |

## Eliminations (rationale)

- **3 wrapped** — the *format* virality is real but **December-seasonal and post-wave as of
  June 2026**; the npm-download-specific variant has a track record of flat HN launches
  ("graveyard"). Mistimed for a 6-week near-term window. *Revivable as a Dec-2026 seasonal
  play, not now.*
- **9 npx-card** — **weakest validated pain (2/5)** with active counter-signals (CoreUI HN
  "downloads don't convert / are inflated"; `own-term` npx portfolio 2 pts; `npm-downloads-
  counter` ~62 dl/mo, abandoned). The *validated* form of "embeddable identity card" is
  github-readme-stats-style SVG — **which ephemeris already ships as `/badge/[slug]`.** The
  npx-CLI delivery is the weak variant; redundant.

## Survivors → Phase 5 scoring: **4, 7, 11, 12**

## Cross-cutting strategic read (load-bearing for Phase 5)

1. **The defensible wedge is the inverse of the hot wave.** The whole supply-chain wave (PEAK)
   fixates on *release age* ("is this version too NEW to trust?" — cooldowns across
   pnpm/yarn/bun/npm/uv). Nobody packages *adoption age* / per-version download-**share**
   ("what % of installs are still on the old major?"). ephemeris already captures it. This is
   option **4**, and it is the single most differentiated, lowest-platform-risk, on-thesis
   asset we have.
2. **Consumer-side is crowded; maintainer-side is empty.** Every health/verdict tool is
   consumer-facing ("should I depend on this?"). The OP-HYPE agent flagged the **maintainer-
   side flip as uncontested** — and it is exactly ephemeris's `/u/<login>` owned-identity
   surface. This argues for a maintainer-facing merge of **4 + 7** (a grounded
   adoption/health card for *your own* packages) over a pure consumer evaluator tool.
3. **Snyk Advisor is vacating the embeddable health-card surface (Jan-2026).** Timing gap.
4. **"Signal, not a verdict" honest register is on-trend, not contrarian** (MCPSkills.io uses
   the exact phrase; Nesbitt/PkgPulse stress no single signal is decisive). ephemeris's
   no-opinion stance fits the rising sentiment — *but must avoid the saturated 0-100 score and
   cooldown angles.*
5. **npm downloads alone have never produced a wrapped-scale viral spike** (HN graveyard).
   The proven virality lives in narrative/persona/roast and GitHub social proof. ⇒ a pure
   honest-number artifact likely needs a **borrowed narrative hook** (e.g. the emotional
   proof-of-impact framing of **12**, or the supply-chain attention of **7**) layered on real
   numbers — and **off-season timing** (GitHub **Maintainer Month = May**, or the supply-chain
   news cycle) rather than the Dec wrapped scrum.

## Open data caveats

- Reddit/X were partially unsearchable in-environment (WebFetch blocked for reddit.com on
  several agents); pain signal for 4/9/11/12 may be *understated* (the maintained? agent did
  reach Reddit and found strong signal). Treat pain intensities as lower bounds where Reddit
  was blocked.
- Several star counts / last-release dates are search-snapshot, not gh-API-verified (flagged
  inline by agents). Load-bearing eliminations do not depend on exact star counts.
