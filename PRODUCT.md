# ephemeris

## Register

product — utilitarian dashboard, not a marketing surface. Design serves the data.

## Product Purpose

Daily npm download counts and GitHub stargazer counts for an owner's package portfolio, with weekly momentum deltas (up / flat / down) across 13 weeks. One owner curates the watchlist; visitors view a read-only public dashboard at a shareable URL.

Name `ephemeris` = an astronomical table of celestial positions over time. The metaphor is observation: positions of objects (packages) plotted across time.

## Users

- **Owner** (single GitHub-authed maintainer): adds/removes packages, glances at portfolio momentum daily, late evening or early morning, typically on a laptop in a dim room. Mood: low-attention, pattern-recognition. Not exploratory; checking on known objects.
- **Visitor** (public read-only): clicked through from a tweet, README, or share link. Wants to inspect the maintainer's portfolio quickly. Possibly mobile. Will not log in.

## Use Context

A scientific-instrument feel, not a SaaS surface. The dashboard is the "observatory": it tells you which of your stars are still bright, which are dimming. The 24px blueprint grid texture beneath the content is part of the metaphor.

Density-dense: 16 packages × (mini-chart + 4 metrics + delta) fit on one screen without scroll. Sparklines, not full charts. Mono digits, tabular nums. Color encodes status (success / destructive / muted), not decoration.

## Voice & Tone

Technical, terse, lowercase by default for chrome (labels, badges, captions). Sentence case for content. No marketing words. No exclamation. No emoji. No em dashes.

Allowed shorthand: `dl / wk`, `dl / 13 wk`, `vs prev`, `★`, `▲ rising` / `— flat` / `▼ falling`.

## Anti-references

Run from these reflexes:

- **The SaaS dashboard cliché.** Big hero metric, four equal-width cards underneath, sparklines as decoration, purple gradient on the CTA. We avoid hero-metric template entirely; the stat strip is dense and bordered, not heroic.
- **The "AI tool" purple/blue gradient aesthetic.** No `bg-gradient-to-r from-violet-500 to-cyan-500`. The single accent is a desaturated blueprint blue (OKLCH 0.65 0.16 257).
- **Infinite-feed engagement design.** No "trending" carousels, no social proof badges, no notification dots inviting return visits. Glance-and-leave is the success state.
- **Marketing landing-page tropes** on the login screen. No three-column "Why ephemeris?" feature row, no testimonial strip, no "Get started for free" CTA. The login surface is an instrument check-in, not a funnel.
- **Generic empty states** with cartoon illustrations and a "Get started" button. Empty states stay in the same visual register as the populated dashboard.

## Strategic Principles

1. **Status > decoration.** Every color is semantic (success / destructive / warning / turquoise / primary). If a hue doesn't encode meaning, it gets removed.
2. **Tabular numerals always.** Numbers line up vertically. Mono font (Geist Mono) for all values.
3. **Density is a feature, not a bug.** Generous padding only on the login surface and empty states. The dashboard itself is packed.
4. **Owner-only edit affordances are inline.** No "settings" page; add/remove a package right where it lives (sidebar + card chrome).
5. **Dark-only.** No theme switcher. The product is meant to be used at low light.
