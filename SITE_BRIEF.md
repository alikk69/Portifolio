# Ali Ezbayel Portfolio — Site Brief

**Paste this whole file into a new chat to give an AI full context on this site before asking it to make changes.**

This is a purpose-built summary, verified against the live files as of 2026-08-13. It is NOT the same as `PROJECT_NOTES.md` in this folder — that file is a chronological build log (34+ rounds) and its *opening section* is stale (written early in the project, before several later rounds changed the palette, fonts, and background entirely — don't trust its "Design system" section). This brief supersedes it for anything the two disagree on. `PROJECT_NOTES.md` is still worth reading for the *reasoning* behind specific bugs/decisions if you need the full history.

---

## 1. Basics

- **Owner:** Ali Nadeer Ezbayel — recent Banking & Finance graduate, Bahrain Polytechnic University. Site is a job-hunting / personal-branding portfolio.
- **Live domain:** `aliezbayel.space`, hosted on **Netlify**. Deployed by dragging the project folder into Netlify's dashboard — no build step, no framework, no CLI.
- **Project folder:** `C:\Users\alina\Downloads\Claude\portfolio-site\`
- **Files:** `index.html`, `style.css`, `script.js` — plain HTML/CSS/JS, no bundler. Dependencies are all CDN `<script>` tags: **GSAP 3.12.5 + ScrollTrigger**, **Three.js r128**, Google Fonts.
- **Images:** `images/profile-photo.jpeg`, `images/favicon.svg`, `images/logos/*.{png,svg}` (employer/school logos: afs, apg, bfb, injaz, nm, poly).
- **Contact facts** (don't invent alternates): phone `+973 3596 6325`, email `ali.ezbayel@gmail.com`, LinkedIn `linkedin.com/in/ali-ezbayel/`.

### Preview locally
No dev server config currently checked in. Simplest: `python -m http.server 8933` from inside `portfolio-site/`, then open `http://localhost:8933/index.html`.
**Cache-busting is manual**: `index.html` loads `style.css?v=N` and `script.js?v=N` with version query strings — **bump both numbers on every edit** or the browser will silently serve stale CSS/JS. Current versions as of this brief: `v=50` / `v=83` — check the actual file, this will have moved on.

There is also a `.claude/launch.json` checked in now, so `preview_start` (or any launcher reading it) can start the `python -m http.server` on port 8933 without hand-rolling the command.

### Redeploy
Drag the whole `portfolio-site` folder into Netlify's dashboard for the same site. Nothing else needed.

---

## 2. Design system (verified against current `style.css` `:root`)

**This is NOT "The Ledger" (warm paper/serif) described early in PROJECT_NOTES.md — that was replaced in an earlier round.** Current system: clean neutral grayscale + one sharp accent.

```css
--paper: #ffffff;          --paper-dim: #f6f7f9;
--paper-panel: #eef0f3;    --paper-panel-strong: #e2e5ea;
--line: rgba(15,17,21,.1); --line-strong: rgba(15,17,21,.2);

--ink: #101216;   --ink-dim: #565b66;   --ink-faint: #686c75;

--gold: #c13a20;         /* the ONE accent color — vermillion/red, despite the name */
--gold-bright: #ff6b3d;
--teal: #454952;         /* now a neutral graphite, not a distinct hue */
--rose: #7c7568;         /* now a neutral taupe, not a distinct hue */

--card-ink: #0d0f13;     --card-ink-2: #191c22;   /* credit-card gradient only */
```

**Gotcha:** `--gold`/`--teal`/`--rose` are kept as *variable names* only because ~30 places in `index.html` use inline `style="--accent: var(--gold)"` and `script.js`'s data objects key colors as `"gold"/"teal"/"rose"` strings. Don't be misled — `--gold` is red. If you ever rename these, update both files together.

**Fonts:** `Manrope` (weights 400–800) for everything — headings and body both, one confident sans, no serif. `IBM Plex Mono` for data/labels/eyebrows/nav only. Loaded via Google Fonts `<link>` in `<head>`. (Fraunces/Archivo/Abril Fatface were all tried at various points and are **not** currently used — ignore any note that says otherwise.)

**Layout:** single scrolling one-pager. `--max-width: 1140px`, `--gutter: clamp(1.25rem,4vw,2.5rem)`. Section order: About → Experience → Skills → Achievements → Education → Contact. Hamburger nav below 860px (`#navToggle`/`#primaryNav`) — a font-shrink approach was tried and verified to overflow off-screen; don't revisit that.

---

## 3. Section-by-section (current state)

- **`#about` (Hero):** name, rotating typewriter tagline, ID-style photo. **"Configure the Analyst" widget** (`.hero-config`) — three clickable setting rows that live-update an output card via `render()` in script.js:
  - **Focus** (`data-value="0|1|2"`): Business Dev / Fintech Research / Partnerships
  - **Sector** (`data-value="technical|business|analytical"`): Technical / Business & Ops / Analytical
  - *(There is no "Region" setting — it existed early on and was explicitly removed. Don't re-add it.)*
  - Blurb text for all 9 Focus×Sector combinations lives in `BLURBS` object in script.js, keyed like `"0-technical"`. These are real, specific copy — not templated filler. Edit content there, not by guessing generic phrasing.
  - Desktop (≥901px) draws dashed SVG "wires" connecting nodes to the output card, computed live from element positions. Below 900px it's a plain stacked column (deliberately simple — mobile layout bugs elsewhere burned a lot of time earlier in the project).

- **Background — 3D financial skyline (Three.js/WebGL):** fixed canvas (`#skylineCanvas`), each tower is an actual candlestick shape (open/close body + high/low wick), with particles and idle motion (sway/bob/drift) so it's never fully static even without scrolling. **Desktop + WebGL only** — bails to a cheap flat gradient (`.global-backdrop`) on mobile, no-WebGL, or `prefers-reduced-motion`, and that fallback must never look broken/blank.

- **KPI strip:** 5 stats count up with a synced progress bar. Dark `--ink` background band. Desktop is a 5-column grid where all five count together over 8.5s. Below 680px it's a one-at-a-time scroll-snap carousel that **auto-advances every 4.6s**, sweeping 1→5 then back 5→1 rather than looping (a wrap would make one step in five a smooth scroll across four cell widths, visibly racing backwards past every stat). The count-up drops to 3.4s there so each figure lands before its card slides away. It only runs while the strip is on screen and the tab is visible, never under `prefers-reduced-motion`, and **any swipe or dot tap stops it permanently** — there's no hover to resume from on a phone, and a carousel that restarts after you deliberately swiped is the single most irritating version of this pattern. Position is tracked in `kpiIndex`, deliberately **not** re-derived from `scrollLeft` each tick: a smooth scroll is often still settling when the next timer fires, so reading it back yields an intermediate index.

- **`#experience`:** draggable/zoomable node-canvas ("explorer") on desktop — role chips wired by an animated SVG connector into an output panel. Mobile: horizontal swipeable chip row + swipeable card carousel (CSS scroll-snap), **not** the drag canvas. Two real bugs fixed here recently, worth knowing about if this area gets touched again:
  - `.career-edge-svg` (`z-index:2`) was painting its dashed connector lines *over* `.career-node` (`z-index: auto`) — logos got visually clipped by the lines. Fixed by giving `.career-node` `z-index: 3`. If you add any other positioned element in this canvas, check it isn't silently under the SVG.
  - The mobile "there's more to swipe" affordance is `.career-nav-scroll` — a small track+thumb scroll indicator under the role-chip row (NOT an arrow — an arrow was tried, only pointed one direction, and overlapped whichever chip was at the edge). There's a parallel `.career-swipe-cue` (written "Swipe for more roles" text) under the card carousel. **Both must have an explicit `display: none` outside their mobile media query** — they're `<div>`s styled only inside `max-width: 820px`, so omitting the base rule makes them show on desktop by accident (this exact bug shipped once already).

- **`#skills`:** editorial numbered-list index (not a "trading terminal" watchlist — that concept was explicitly rejected). Category tabs: Technical / Business & Ops / Analytical. **Known-fragile spot:** `.trade-row` is deliberately *excluded* from the generic `scrollReveal()` GSAP treatment applied to most other elements — adding it back reintroduces a glitch where switching categories shows a leftover invisible state before the CSS fade-in catches up. There's a comment in script.js at that exclusion explaining why; read it before changing.

- **`#achievements`:** card grid + click-to-open modal (year/title/story), pinned scroll-jacked "journey" through 3 milestones on desktop only (≥821px width AND ≥700px height — pinning is unreliable with mobile browser-chrome resize, so it's gated off entirely below that, falling back to a plain grid with normal fade-in reveals). This is the site's **only pin** other than none — see §4 below on why that matters.

- **`#education`:** static, non-interactive by design (an interactive version was tried and reverted).

- **`#contact`:** a credit card that rises out of a wallet/pocket on scroll — the one deliberately dark object on the site, sitting in a lightly gridded/backlit stage. **This is the most-iterated, most fragile part of the site — read §5 before touching it.**

---

## 4. Architecture notes that matter

- **GSAP pins must be created together, in one shared block.** There's a documented, previously-real bug: creating `ScrollTrigger.create({pin:true})` calls in separate places in the script left earlier pins with stale start/end positions, because each call computes them against the document height *at that instant*, and a later pin's spacer insertion shifts the page height out from under an earlier one. The Achievements pin lives in one `ScrollTrigger.matchMedia()` block for exactly this reason. If anything else on the site ever needs a GSAP pin, it must go in that same block, not a new standalone `ScrollTrigger.create` elsewhere.
- **`position: fixed`/`sticky` breaks under a transformed ancestor.** Any non-`none` CSS `transform` on an ancestor creates a new containing block for `position: fixed` descendants, silently repositioning them relative to that ancestor instead of the viewport. This bit both the achievement modal (fixed via `.reveal.in-view { transform: none }` — not `translateY(0)`, which is *not* the same thing for this purpose) and the credit card's `position: sticky` reveal (bit by `#contact`'s own entrance-reveal transform). If something with `fixed`/`sticky` positioning starts behaving strangely — moving with scroll when it shouldn't, or vice versa — check every ancestor's `transform` first.
- **`overflow: hidden` breaks `position: sticky` in descendants.** `#contact` had this for a decorative glow's clipping and it silently broke the card's sticky reveal. Removed. Don't re-add `overflow: hidden` to any section that contains a `position: sticky` element.
- **`mix-blend-mode` on the card's shine layer caused a full black-out** on some GPUs, inside the sticky + nested-transform stack. The shine uses plain `opacity` now — never reintroduce a blend mode there.
- **The readability scrim (`.has-skyline .page::before`) is load-bearing, not decoration.** `#experience`, `#achievements` and the hero are transparent, so their text sits directly on the WebGL skyline — and the lanes span the full viewport width, so a near-field vermillion candle really does pass behind the content column. Measured against that worst case, body copy is **1.26:1** with no scrim and **5.52:1** with it. The `0.86` centre alpha is the tuned value; lowering it for a bolder skyline costs roughly 0.07 of contrast ratio per 0.02 of alpha, and below ~0.84 the small mono labels drop under AA. It's gated on the `has-skyline` class that script.js adds only when the renderer actually paints, so mobile/no-WebGL keep the untouched flat gradient.
- **Three widgets use a roving tabindex** (`.config-option` radiogroups, `.trade-tab` tablist, `.career-node` tablist): only the selected item has `tabIndex 0`, the rest `-1`, with arrow/Home/End handlers moving between them. `showCareerPanel()` and `showSector()` maintain it, and there are explicit initialisers for the page-load state. If you add or re-render items in any of those groups, the tabindex has to be re-synced or the group becomes unreachable by keyboard.
- **`.ach-card` is a `<div>`, and the real control is `.ach-card-btn` stretched over it via `::after { inset: 0 }`.** It was a `<button>` wrapping an `<h3>` and two `<p>`s, which is invalid (button takes phrasing content only) and flattened the card into one run-on accessible name. Consequences to preserve: `.ach-card::after` (the ✓ badge) **must** keep `pointer-events: none` or it re-creates a dead click zone in the corner; the focus ring is drawn on the card via `:has(.ach-card-btn:focus-visible)`; and the modal's click handler binds to `.ach-card-btn`, while GSAP's pinned journey still targets `.ach-card`.
- **`--line-ui` vs `--line`/`--line-strong`.** The lighter two are for decorative rules and dividers. `--line-ui` (0.5 alpha, clears 3:1 per WCAG 1.4.11) is for the borders of actual controls — buttons, tabs, option pills, nav toggle, zoom buttons, modal close. Don't collapse them back into one token; the light ones fail 1.4.11 on controls and the dark one is too heavy for dividers.
- **Pagination dots are 44×44 `<button>`s with `gap: 0`, the visible dot drawn by `::before`.** They were 6px `<span>`s with click handlers inside `aria-hidden` containers, each given a `-19px ::after` hit area — a 44px target on a 12.8px pitch, so targets overlapped ~70% and the later sibling swallowed its neighbours' taps. The zero gap is deliberate: it's what makes the targets tile instead of overlap.
- **`scrollReveal()`** (script.js) is the shared "fade/slide in once, on scroll" helper used almost everywhere. Its default is `from: {opacity:0, y:50}` → `to: {opacity:1, y:0}`; passing a custom `to` without an explicit `y` silently leaves the default `y:0` — that's usually fine, but if you ever pass a *non-zero* target position, you must include it explicitly in `to`, or it'll compute against a wrong default. This exact class of bug (a missing `to.y`) has shipped at least twice on this site (education items once, the card's slot once).

---

## 5. The credit card — history and current state

This went through **9 distinct rounds** (see PROJECT_NOTES.md rounds 25–34 for full blow-by-blow). Do not restart from scratch without reading at least the summary below — most of the obvious-looking approaches have already been tried and failed for specific, documented reasons.

**Current architecture** (as of round 34): a tall `.cc-scroll` spacer (150vh) containing a `.cc-sticky` frame (`position: sticky; top:0; height:100vh`) that holds the card+wallet centered in the viewport while the spacer scrolls behind it. The card's reveal progress is computed directly from scroll position every frame (`-rect.top / (scrollHeight - viewportHeight)`, clamped 0–1) — **not** GSAP-scrubbed, **not** pinned, **not** a one-shot trigger. This is deliberate and load-bearing:
- Because it's a *pure function* of scroll position with no animation state, it structurally cannot get stuck revealed, and reverses correctly every time you scroll back up — several earlier one-shot-trigger versions latched open permanently.
- Because the card only moves while `.cc-sticky` is pinned, and by that point the heading/intro above have already scrolled off, it structurally cannot cover text — several earlier versions needed careful pixel-margin tuning to avoid this and kept failing by a few pixels at some viewport width.
- A GSAP-pinned/scrubbed version was tried (matching a supplied design spec exactly) and worked correctly but read as "laggy" — scrub's catch-up smoothing lags real scroll input. The current version is native-scroll-driven with no smoothing lag.

**Key tuned constants in script.js** (`CARD_TUCK_Y`, `CARD_REVEAL_Y`) and matching CSS (`.cc-wrap` stage height, `.cc-wallet` height, `.credit-card`'s `bottom` offset) are **not arbitrary** — they were derived from real measured geometry (the wallet and card's bottom edges are both anchored to the same parent's bottom, so clearance is independent of card width) and then adjusted again when the card was resized. If you resize the card or wallet, re-verify clearance at both ends of the reveal, not just visually — a few pixels of overlap is easy to miss by eye and was shipped more than once.

**Also currently present:** hover tilt (`mousemove` → ±14° `rotateX`/`rotateY`, independent of the scroll-driven transform, composed into the same transform string), a shine sweep (plain opacity, see §4), a `.cc-sticky::before`/`::after` backdrop (blueprint grid + warm glow) added specifically because an earlier version left the card floating alone in a blank viewport — don't strip the backdrop without adding something else in its place.

**On testing this specific section:** if you're using a headless/automated browser tool to verify it, be aware that some tools freeze `requestAnimationFrame` and CSS transitions when they report the tab as backgrounded/hidden, which can make working code look broken in testing (GSAP tweens stuck at time 0, CSS transitions never progressing). Also, `Element.getAnimations()` does not report GSAP-driven tweens at all — only native CSS transitions/WAAPI. If a scroll-driven reveal looks stuck during testing, force-recompute from real scroll position and check computed styles directly, rather than trusting animation-inspection APIs.

---

## 6. Content/copy conventions

- **No inflated numbers.** "100+ properties" was explicitly removed from two places (a stat chip and body copy) at the owner's request — keep specific, defensible figures only, and check with the owner before adding round numbers that read as inflated.
- **Use the owner's exact wording when they supply it**, rather than substituting based on your own reasoning about site-wide consistency — this has been corrected more than once (a job title, a tagline). If reconciling their wording with something else on the site seems necessary, ask first.
- **No AI-writing tells**: the owner has asked for em-dash constructions and certain trailing clauses to be trimmed from copy previously — keep sentences direct.
- **Verify before shipping wording changes** the same way as functional changes: reload, check computed/rendered text, don't just trust the edit.

---

## 7. Known outstanding items

- No CV/resume download button — asked about explicitly, owner said skip it for now.
- No custom email set up on the domain.
- Site has not been redeployed recently — check with the owner whether local changes have made it to `aliezbayel.space` before assuming the live site matches the local files.
