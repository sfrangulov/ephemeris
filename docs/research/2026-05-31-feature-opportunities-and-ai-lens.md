# Feature research: what ephemeris should build next (incl. the AI lens)

**Date:** 2026-05-31
**Method:** research-pipeline — 4 parallel research subagents (competitor landscape · maintainer JTBD · AI-in-dev-tools · data/feasibility) + one dispatched adversarial refutation pass. 14 content-addressed snapshots; verbatim-substring gate run on every load-bearing quote. Scope/ambition fixed with the owner up front (see recon preamble).

```recon-manifest
# -1a scope (answered by owner 2026-05-31):
#   objective   = landscape -> ranked backlog -> killer-feature deep-dive (in that order)
#   ambition    = new surfaces OK (alerts/digests/discovery/API) but solo-buildable + free; monetization not the frame
#   AI role     = one lens among several; best idea wins regardless of whether it is AI
#   freshness   = current dev-tooling (2025-2026); project-payload = PRODUCT.md / DESIGN.md / v2 spec (already on hand)
# Honest boundary: landscape breadth claims (npm-trends columns, moiva history, Socket/Snyk pricing) rest on
#   subagent triage, not snapshots, and are flagged inline. The 14 snapshots back the load-bearing claims only.
yes	https://blog.isquaredsoftware.com/2022/07/npm-package-market-share-estimates/	authoritative	stale?	Redux maintainer's per-version-timeseries wish + stars!=usage	snapshotted:1b1f549b
yes	https://nesbitt.io/2026/05/02/a-github-for-maintainers.html	authoritative	current	maintainer wishlist: version-adoption + dependents feed	snapshotted:2b19b1bb
yes	https://opensource.guide/maintaining-balance-for-open-source-maintainers/	official	current	GitHub: lack-of-positive-feedback as burnout driver	snapshotted:35490551
yes	https://dev.to/tidelift/the-open-source-maintainer-community-is-getting-grayer-1gc2	authoritative	current	2024 survey: underappreciated/quit numbers	snapshotted:d79d668b
yes	https://www.honeycomb.io/blog/introducing-query-assistant	official	current	AI vendor rejects AIOps/anomaly narration	snapshotted:d885704d
yes	https://github.com/github/copilot-release-notes	official	current	honest-AI pattern: uncertainty flagging	snapshotted:2420c6b9
yes	https://github.com/npm/registry/blob/main/docs/download-counts.md	official	current	per-version downloads = last-7-days only (moat basis)	snapshotted:8cb86c06
yes	https://www.star-history.com/blog/add-a-live-star-history-chart-to-your-github-readme/	official	current	the SVG-image README badge distribution model	snapshotted:715729d2
yes	https://docs.scarf.sh/package-analytics/	official	current	closest who-uses competitor surface	snapshotted:1de8e6b1
yes	https://blog.deps.dev/api/	official	current	deps.dev is dependency/security-centric, not maintainer-facing	snapshotted:ef76f258
yes	https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/react	official	current	percentile rankings + dependents 275k	snapshotted:ecc82215
yes	https://api.deps.dev/v3alpha/systems/npm/packages/react/versions/19.2.6:dependents	official	current	dependents 26k vs ecosyste.ms 275k (honesty constraint)	snapshotted:e7a1d8e0
yes	https://shields.io/badges/dependents-via-libraries-io-scoped-npm-package	official	current	shields already ships a dependents badge (C4 not differentiated)	snapshotted:77ebc1c4
yes	https://moiva.io	official	current	graveyard live-evidence: moiva/snyk-advisor/npms deaths	snapshotted:0e62d40f
yes	https://securityboulevard.com/2026/05/download-pumping-new-npm-deception-technique-for-supply-chain-attacks/	authoritative	current	download-pumping: per-version counts are bot-gameable	gap:weakened
no	https://npmtrends.com/about	general	current	download-comparison utility (landscape only)	
no	https://socket.dev/pricing	general	current	supply-chain security pricing (landscape only)	
```

## Bottom line (after the adversarial pass)

The convergent, defensible play is **not** an AI feature. It is a longitudinal, honest dataset the hype-driven tools structurally will not build because it is unglamorous:

> **A persisted weekly per-version download-share time-series** — "is my old major's share finally shrinking, and how fast is the new one taking over?" — as a portfolio surface plus an embeddable badge.

The moat is real but narrow, which the adversarial pass sharpened rather than dismissed: npm exposes per-version download counts only for the **last 7 days** [^h:8cb86c06], and the existing download historians persist only *aggregate* downloads, never per-version. So whoever starts snapshotting that 7-day window weekly owns a dataset nobody else has — which is, almost verbatim, the thing a senior maintainer wished aloud for: a tool that would "automatically scraping these per-version downloads stats and save them to allow comparisons over time" [^h:1b1f549b]. ephemeris already runs a 6h cron and already fetches registry metadata, so the marginal cost is low.

The single non-negotiable honesty constraint: label it **"download share per version,"** never "adoption" or "what users are running." npm counts are dominated by CI, mirrors, and bots (there is even an active "download-pumping" attack class), so a production-usage claim would be the exact register violation this product was built to avoid. `[primary, verified, weakened]` — the claim survived as a *reframed* feature, not as the "adoption" pitch it started as.

**On AI:** evaluated honestly as one lens, every AI feature that even survives scrutiny is either off-mission or already commoditized. AI is not the killer feature for an honest-instrument product. See Part 5.

---

## Part 1 — Competitive landscape

Every adjacent tool is exactly one of: **single-metric**, **evaluator-facing / ad-hoc** (you look up someone else's package once and close the tab), or **non-visual infrastructure** (an API/dataset, no UI). None combines an owned per-maintainer identity, both downloads *and* stars over time, an explicit week-over-week momentum delta, and embeddable README badges in a deliberately non-engagement register. That combination is ephemeris's seam.

| Tool | What it is | Badge story | Closest overlap / what it lacks vs ephemeris |
|---|---|---|---|
| **star-history.com** | GitHub star-history charts | Strong — live SVG-image link for READMEs [^h:715729d2] | The DNA twin of ephemeris's distribution loop, but **stars only**: no downloads, no momentum, no owned identity |
| **npm-trends** | multi-package download comparison over time | none | comparison utility, evaluator-facing; no badges, no per-maintainer page, no momentum |
| **Scarf** | install-time telemetry, "which companies use your package" [^h:1de8e6b1] | none | answers *who* uses you (a dimension ephemeris omits); needs a code change, privacy-contentious, aimed at OSS vendors not solo maintainers |
| **Snyk Advisor** | per-package health score + maintenance signals | vuln badges only | evaluator-facing; **being absorbed** into security.snyk.io [^h:0e62d40f] |
| **deps.dev (Google)** | dependency graphs, licenses, OSV, Scorecard [^h:ef76f258] | none | supply-chain/security substrate, not maintainer-facing; no trend viz, no badge |
| **ecosyste.ms** | cross-ecosystem package+repo metadata API | none | richest free dependents + percentile data [^h:ecc82215]; infrastructure, no UI/badge |
| **shields.io** | the badge substrate everyone builds on | the substrate itself | single live number per badge, **no history/trend/momentum**; already ships npm-downloads, stars, and a **dependents** badge [^h:77ebc1c4] |

**The graveyard (the strongest counter-argument, live-verified [^h:0e62d40f]):** moiva.io — the most feature-complete "compare every metric" solo product — is **dead** (301 → a parked domain). npms.io is **frozen** (its scoring API has not updated since Jan 2023). Snyk Advisor is **absorbed** into Snyk's security DB. The lesson is *not* "no market" — deps.dev, ecosyste.ms, shields, and npm-trends are all alive. It is that **raw metrics alone do not sustain a standalone product**; the survivors are either infrastructure-subsidized or a security-platform funnel. The moat must be the *combination + owned identity + README distribution loop*, not the raw numbers. `[primary, verified, survived]`

## Part 2 — Maintainer JTBD (the demand side)

What maintainers actually want, ranked by evidence convergence:

1. **"Is anyone using this, and is it growing?" — proof of impact against a silent userbase.** GitHub's own maintainer-balance guide names the absence of this as a primary burnout driver: "Lack of positive feedback: Users are far more likely to reach out when they have a complaint" [^h:35490551]. Tidelift's 2024 survey (n=400+) quantifies the wound — nearly half of maintainers "feel underappreciated," and around two-thirds have "quit or considered quitting" [^h:d79d668b]. This is the emotional case for honest usage data — not a vanity scoreboard, but the only proof of impact a silent userbase never volunteers.

2. **"Which versions are downstream users actually on?"** The single most concrete wished-for surface: "A breakdown of which versions of this project downstream users are actually running, so a maintainer can see how many are stuck three majors behind" [^h:2b19b1bb] — and, independently, the explicit wish for a per-version download time-series scraper [^h:1b1f549b]. This is exactly the killer-feature seam.

3. **"Who depends on me?"** Real and recurring, but a *commodity* — shields already ships a dependents badge [^h:77ebc1c4], and the dependents number itself is unreliable (Part 4).

4. **Reach dependents before breaking them** (deprecation / CVE / "looking for maintainers"). Strongly evidenced as a need but **off-register** for ephemeris: a broadcast/feed channel is a social-coordination product, not a scientific instrument.

**Counter-evidence (held, not dismissed):** the most sophisticated maintainers discount these very metrics — downloads as noise, stars as "vague popularity not usage." Notification/dashboard fatigue is a documented failure mode. This does not negate need #1; it constrains *form*: honest, relative, over-time data answering an emotional question is wanted; vanity scoreboards, leaderboards, and push-notification streams are exactly what maintainers have learned to tune out.

## Part 3 — Ranked backlog

Tiers reflect the post-adversarial verdicts, not the raw subagent enthusiasm.

**Tier 1 — build (register-safe, differentiated, cheap):**

1. **Per-version download-share time-series** — the killer feature. Deep-dive in Part 4. `[primary, verified, weakened]` (survives as "download share," not "adoption").
2. **"last published N days ago" / release cadence** — already inside the npm registry metadata ephemeris fetches; zero new API calls. Fills a real Snyk-Advisor-style gap maintainers check (is this stale?). Not differentiated, but near-free and honest.

**Tier 2 — useful, with honesty caveats:**

3. **Weekly "movers" digest (opt-in email).** Serves the strongest-evidenced JTBD (proof-of-impact). Risk: notification fatigue. Ship only if opt-in, terse, and gated by the *existing* `momentumStatus` (5% AND `sqrt(prev)` AND `prev≥20`) so it reports only real deltas — no `+0` noise, no engagement bait.
4. **Dependents count badge — only with an explicit source + definition label.** A real JTBD (#3) but **not a differentiator** (shields already has it [^h:77ebc1c4]) and the number is ambiguous: ecosyste.ms reports react `dependent_packages_count: 275174` [^h:ecc82215] while deps.dev reports `dependentCount: 26380` for the same package [^h:e7a1d8e0] — an order-of-magnitude gap over *different definitions*. Low priority; if shipped, pin one named source + one named dimension + the absolute count. `[primary, verified, weakened]`

**Tier 3 — do not build:**

5. **AI "why did downloads spike/drop" explainer.** Register violation. Even Honeycomb — a vendor that *sells* AI observability — calls anomaly-detection/AIOps narration "a misapplication of AI" [^h:d885704d]. ephemeris holds the count, never the cause (CI, mirror, bot, blog post); an LLM asked "why" will always emit a fluent guess dressed as a finding. `[secondary, verified, survived]` (i.e. the "don't build it" recommendation survived).
6. **Chat / NL copilot over the portfolio.** The matrix already says everything at a glance ("data IS the marketing"); a chat box implies a complexity that is not there, and is the purple-gradient AI aesthetic the product explicitly anti-references.
7. **Percentile "top X% of npm" badge.** Tempting but honesty-hostile: react's rank swings ~300× across dimensions (top ~0.006% by dependents vs top ~1.6% by downloads) [^h:ecc82215], so any "top X%" headline is cherry-picked — the marketing-flex the register forbids.

## Part 4 — Killer-feature deep-dive: per-version download-share time-series

**The job.** A maintainer who just shipped v5 wants to know: is anyone leaving v4? Is the v3 long-tail finally dying, so I can drop support? Today they cannot answer this over time from any tool.

**Why it is the seam.**
- *Demanded, in maintainers' own words* — the version-stuck wish [^h:2b19b1bb] and the per-version-scraper wish [^h:1b1f549b] are two independent senior maintainers asking for exactly this.
- *Un-built, durably* — npm's per-version endpoint returns only the **last 7 days** [^h:8cb86c06]; the per-version *snapshot* is commoditized (several CLIs show it), but no tool *persists* it longitudinally. The moat is the archive, and it compounds: a competitor starting later still has no history.
- *Cheap for ephemeris specifically* — the 6h cron and registry-meta fetch already exist; this is one more weekly capture, stored like `download_daily`/`star_daily`.
- *Register-native* — it is pure honest data; it extends the matrix metaphor (a per-version "migration" view: are the old major's bands shrinking?).

**The honesty discipline (load-bearing — this is where the adversary bit hardest).** npm per-version counts are CI/mirror/bot-heavy and gameable (the download-pumping attack class). Therefore:
- Headline copy is **"weekly download share per version,"** never "adoption" or "what users run."
- Apply the same noise discipline already in the codebase: a Poisson-style floor and the `momentumStatus` gate, so a version's "decline" is only shown when it clears noise.
- Show *share* (relative %) prominently and absolute counts secondarily — share is the honest, comparable signal; absolutes invite the vanity read.

**Shape.** A per-package surface on `/u/[slug]` (a stacked-share band per major version over the trailing weeks) and a per-package badge variant (`/badge/[slug]/[pkg]/versions.svg`) showing the current top-versions split — flex-worthy *and* honest, and it drops straight into the existing distribution loop.

**Open risk.** This is item #1 on a ~10-item maintainer wishlist, not a validated "single best." Treat it as the leading bet to *prototype and put in front of a few maintainers*, not a proven slam-dunk. The cheapest way to de-risk: ship the data capture now (it is near-free and compounding), decide the surface after a month of real data.

## Part 5 — The AI lens: honest verdict

Asked to find an AI killer feature, the honest finding is that there isn't one here — and that is itself the interesting result. Evaluated as one lens:

- The only AI feature that even survives the honest register is **grounded, uncertainty-flagged release-notes** — summarize what shipped between two versions from real git/registry diffs, and (the honest-design pattern worth stealing) separate the model's low-confidence entries for human review the way GitHub's release-notes action does: "Uncertainty flagging — entries the AI isn't confident about are separated for human review" [^h:2420c6b9].
- But even that is **off-mission and commoditized**: it is *authoring* (maintainer-side content), whereas ephemeris is a *measurement instrument*; and GitHub already ships a free native "generate release notes" button plus a crowded field of tools. `[secondary, verified, weakened]` — if ever pursued, it is a separate product, not the killer feature.
- Everything more ambitious (spike-explanations, chat copilots) fails the register (Tier 3).

**So the AI-era move for this product is contrarian:** the durable advantage is an unglamorous honest dataset (per-version share) that AI-hype tools won't bother to build — not a bolted-on LLM. "Data IS the marketing" already is the strategy; AI's most honest role is, at most, a future optional grounded-summary side-surface.

## Open contradictions / what would change this

- **The "adoption" temptation.** If a future version labels per-version share as "adoption / real usage," it canonizes a register violation. Held open deliberately: the data is download *share*, a proxy, not production usage.
- **Demand is inferred, not surveyed.** No source directly asked maintainers "rank what you want to track." The need is triangulated from burnout drivers, essays, and tool behavior — strong but indirect. Prototype-and-validate before over-investing.
- **download-pumping source not snapshotted.** defuddle returned an empty body for the Security Boulevard article (anti-bot JS-shell); the bot-noise claim is carried as `gap:weakened` and corroborated by npm's own 7-day-only per-version limit and noisy-counts posture [^h:8cb86c06] — not by that one article.

## Provenance & method

Verbatim-substring gate: of the 14 cited snapshots below, every load-bearing quote used above was verified as a real substring of its snapshot (one quote, npm's "*128* packages" bulk limit, is verbatim once markdown emphasis is accounted for). Broader landscape claims that are *not* footnoted to a snapshot (npm-trends columns, Socket/Snyk pricing, moiva's historical metric list) rest on subagent triage and are lower-confidence by design. Adversarial verdicts are recorded inline as `[class, verified, verdict]` epistemic tags on the five load-bearing claims; none was `refuted` (one `survived`-as-stated, two `survived`, two `weakened`-and-reframed).

```provenance-manifest
c1-erikson	https://blog.isquaredsoftware.com/2022/07/npm-package-market-share-estimates/	1b1f549bf75374bfc26d1958770a416bbaeaa7dc4c86af849873e258b6284273	2026-05-31T17:22:34.149015+00:00	defuddle	NPMJS per-version stats note + Github stars section
c2-nesbitt	https://nesbitt.io/2026/05/02/a-github-for-maintainers.html	2b19b1bb6815a91e4f1d157bc2f1dc1058ac3f098ae6248d12f0315c99dc4122	2026-05-31T17:22:34.192331+00:00	defuddle	feed for dependents + version-adoption bullet
c3-osguide	https://opensource.guide/maintaining-balance-for-open-source-maintainers/	354905515713687fb41b85f025b4ecf7953c34e60db897008bdc10a72b795eaa	2026-05-31T17:22:34.234379+00:00	defuddle	causes of imbalance: lack of positive feedback
c4-tidelift	https://dev.to/tidelift/the-open-source-maintainer-community-is-getting-grayer-1gc2	d79d668b388f00ca0a7fa5dd0c2293769a3e402db285286711d7ae3b6bf32051	2026-05-31T17:22:34.276238+00:00	defuddle	underappreciated + quit-or-considered
c5-honeycomb	https://www.honeycomb.io/blog/introducing-query-assistant	d885704db12d1f7b813014c652f8d8975abe61c1505387abce9742c1b6ae181a	2026-05-31T17:22:34.318064+00:00	defuddle	Waxing philosophical: AIOps misapplication
c6-ghcopilot	https://github.com/github/copilot-release-notes	2420c6b9fda9d8ec85e41df08facb2b63f32371c7420bc029b64e2fbde6d785c	2026-05-31T17:22:34.362823+00:00	defuddle	Features: uncertainty flagging; Outputs: uncertain-entries
c7-npmdl	https://github.com/npm/registry/blob/main/docs/download-counts.md	8cb86c068d2e77eeeff65cace18d63bc30c830b00ec4d49ae0f9772b44e4fdeb	2026-05-31T17:22:34.411355+00:00	defuddle	Limits + per-version download counts
c8-starhist	https://www.star-history.com/blog/add-a-live-star-history-chart-to-your-github-readme/	715729d27e61b8428c2ddbebae5185bb9f7b75fc6549fdb015d3f6ee5b079dff	2026-05-31T17:22:34.459406+00:00	defuddle	SVG image link inspiration + token pool
c9-scarf	https://docs.scarf.sh/package-analytics/	1de8e6b16b6462cf6d2761246bebd6eb6a16da9428ae9fb5e8697d27212e4ca6	2026-05-31T17:22:34.506769+00:00	defuddle	JS features + FAQ what info as author
c10-depsdev	https://blog.deps.dev/api/	ef76f258bd216810f3fbc6ab03f2d64a19ff97d22f1269e0a1dfa9fc14357fcd	2026-05-31T17:22:34.556940+00:00	defuddle	The power of dependency data
c11-ecosystems	https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/react	ecc82215e50e069b8f4efdb8f0a1a71fca7f455755adca36aa2cd77b5afe2b9f	2026-05-31T17:22:53.274721+00:00	curl	dependent_packages_count + rankings object
c12-depsdev-dep	https://api.deps.dev/v3alpha/systems/npm/packages/react/versions/19.2.6:dependents	e7a1d8e0956f02add4d052f31dbdca3c364af522648bbaddc696bf796110a26c	2026-05-31T17:22:53.317513+00:00	curl	dependentCount vs ecosyste.ms
c14-shieldsdep	https://shields.io/badges/dependents-via-libraries-io-scoped-npm-package	77ebc1c41fe65f02170c87a5367319a8f8421c8ba15e4c9826bbacd111a50476	2026-05-31T17:28:34.994964+00:00	defuddle	dependents badge exists
c15-graveyard	https://moiva.io	0e62d40fec95b3f81ac7c326fb048f23e78c607cfe20a9ebea6a884d20dd17a0	2026-05-31T17:30:45.937582+00:00	curl	moiva 301 + snyk-advisor 301 + npms.io frozen-2023
```

[^h:1b1f549b]: blog.isquaredsoftware.com — Mark Erikson (Redux), npm market-share methodology; per-version-scraper wish + stars≠usage.
[^h:2b19b1bb]: nesbitt.io — Andrew Nesbitt, "a github for maintainers"; version-stuck wish + dependents feed.
[^h:35490551]: opensource.guide (GitHub) — maintainer balance; lack-of-positive-feedback as a burnout driver.
[^h:d79d668b]: dev.to/tidelift — 2024 State of the Open Source Maintainer survey; underappreciated / quit numbers.
[^h:d885704d]: honeycomb.io — Query Assistant; AI vendor rejecting AIOps/anomaly narration.
[^h:2420c6b9]: github.com/github/copilot-release-notes — uncertainty-flagging honest-AI pattern.
[^h:8cb86c06]: github.com/npm/registry download-counts.md — per-version = last-7-days; bulk ≤128/≤365d, single ≤18mo.
[^h:715729d2]: star-history.com blog — the SVG-image README badge distribution model.
[^h:1de8e6b1]: docs.scarf.sh — install-time "who uses your package" telemetry.
[^h:ef76f258]: blog.deps.dev — dependency/security-centric, not maintainer-facing.
[^h:ecc82215]: packages.ecosyste.ms (react) — dependent_packages_count 275174 + percentile rankings.
[^h:e7a1d8e0]: api.deps.dev (react@19.2.6 dependents) — dependentCount 26380 (vs ecosyste.ms 275174).
[^h:77ebc1c4]: shields.io — existing "dependents (via libraries.io)" npm badge route.
[^h:0e62d40f]: live HTTP/API — graveyard evidence: moiva 301→parked, snyk-advisor 301→security.snyk.io, npms.io frozen 2023.
