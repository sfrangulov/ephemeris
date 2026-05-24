# ephemeris

## Register

product — utilitarian dashboard, not a marketing surface. Design serves the data.

## Product Purpose

Daily npm download counts and GitHub stargazer counts for a maintainer's package portfolio, with weekly momentum deltas (up / flat / down) across 13 weeks. Watchlists are auto-derived from npm (where the maintainer's GitHub login is also their npm publisher name); each maintainer gets a public `/u/<slug>` portfolio page and two flavors of embeddable badge: the portfolio summary at `/badge/<slug>`, and per-package surfaces at `/badge/<slug>/<pkg>/{momentum,sparkline,stars,card}.svg`. The distribution loop is: maintainer signs in → portfolio populates → drops one or more badges in repo READMEs → README readers click through → land on the observatory → some sign in for their own. Per-package micros (momentum, sparkline, stars) sit inside a maintainer's existing shields.io row; the card is a standalone block.

Name `ephemeris` = an astronomical table of celestial positions over time. The metaphor is observation: positions of objects (packages) plotted across time.

## Users

- **Maintainer** (GitHub-authed): one row per profile, populated on first login from npm (`maintainer:<github-login>`). Glances at portfolio momentum daily, late evening or early morning, typically on a laptop in a dim room. Mood: low-attention, pattern-recognition. Not exploratory; checking on known objects.
- **Visitor** (public read-only): clicked through from a tweet, README badge, or share link. Wants to inspect a maintainer's portfolio quickly. Possibly mobile. Will not log in.
- **Platform operator** (single user, gated by `OWNER_USER_ID` env): the only role with the manual sync FAB on top of their self-view. Drives the 6h cron pipeline manually when needed.

## Use Context

A scientific-instrument feel, not a SaaS surface. The portfolio page is the "observatory": it tells you which of your stars are still bright, which are dimming. The 24px blueprint grid texture beneath the content is part of the metaphor.

Viewport-locked: header + matrix + (self-view) edit chrome fit one screen. Only the matrix's tbody scrolls — chrome stays put, the sticky `<thead>` keeps column labels visible while rows scroll. Mono digits, tabular nums. Color encodes status (success / destructive / muted), not decoration.

## Voice & Tone

Technical, terse, lowercase by default for chrome (labels, badges, captions). Sentence case for content. No marketing words. No exclamation. No emoji. No em dashes.

Allowed shorthand: `dl / wk`, `dl / 13 wk`, `vs prev`, `★`, `▲ rising` / `— flat` / `▼ falling`.

## Anti-references

Run from these reflexes:

- **The SaaS dashboard cliché.** Big hero metric, four equal-width cards underneath, sparklines as decoration, purple gradient on the CTA. We avoid hero-metric template entirely; the stat strip is dense and bordered, not heroic.
- **The "AI tool" purple/blue gradient aesthetic.** No `bg-gradient-to-r from-violet-500 to-cyan-500`. The single accent is a desaturated blueprint blue (OKLCH 0.65 0.16 257).
- **Infinite-feed engagement design.** No "trending" carousels, no social proof badges, no notification dots inviting return visits. Glance-and-leave is the success state.
- **Marketing landing-page tropes** on the marketing root `/` or the login screen. No three-column "Why ephemeris?" feature row, no testimonial strip, no "Get started for free" CTA, no hero-illustration. The marketing root shows a live demo of `/u/sfrangulov` as the pitch — the data IS the marketing. Login is an instrument check-in, not a funnel.
- **Generic empty states** with cartoon illustrations and a "Get started" button. Empty states stay in the same visual register as the populated dashboard. (Including the new "no npm packages found" state on `/u/<slug>` — factual sentence, no illustration, same chrome.)

## Strategic Principles

1. **Status > decoration.** Every color is semantic (success / destructive / warning / turquoise / primary). If a hue doesn't encode meaning, it gets removed.
2. **Tabular numerals always.** Numbers line up vertically. Mono font (JetBrains Mono) for all values.
3. **Density is a feature, not a bug.** Generous padding only on the login surface and empty states. The portfolio page itself is packed and viewport-locked.
4. **Self-view edit affordances are inline.** No "settings" page; toggle `is_public`, copy the badge snippet, and (operator-only) trigger sync — all in a single chrome strip below the matrix on `/u/<my-slug>`.
5. **Watchlist is auto-derived, not curated.** No manual add/remove. The product is for npm publishers; whose-packages = `maintainer:<github-login>` on npm. If your GitHub login differs from your npm username, the v2 binding leaves your portfolio empty (acceptable trade, future spec adds explicit `npm_username` capture).
6. **Dark-first.** The web app is dark-only (no theme switcher — the product is meant for low-light glances). Per-package badges default to dark too (visible in any README, distinctive vs shields.io neighbors); maintainers opt in to light via `?theme=light` or to OS-adaptive rendering via `?theme=auto`. The portfolio badge `/badge/<slug>` carries both palettes inside one URL via `prefers-color-scheme` (legacy behavior, kept).
