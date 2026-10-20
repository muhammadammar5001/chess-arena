---
name: wooden-chess-playables-redesign
description: Use this skill when redesigning the existing online chess game (Owl's Gambit) from its web3 purple/neon theme into a polished wooden-style, 2D-with-3D-look casual game for YouTube Playables via Playgama. Covers a full UI/visual redesign, wooden board and piece sets, skill (power-up) UI, unlockable cosmetics via rewarded ads, ad/SDK abstraction, and strict safety rules so existing game logic is never broken.
---

# Wooden Chess: Full Redesign Skill (Web3 to Playables-ready Web2)

## 0. Mission

The project is an online chess game with special skills (Freeze a piece, Swap pieces, 2nd Chance). It was built for a web3 product, so it currently has a dark purple and neon-lime look, wallet and crypto UI, and generic web-dashboard components.

The owner is now publishing it as a **web2 casual game on YouTube Playables through Playgama**, and earning from **rewarded and interstitial ads**.

Your job is a **visual and UX redesign only**, plus a clean ad and unlock layer. The result must feel like a premium, warm, wooden tabletop chess game that a casual mobile player enjoys in the first 5 seconds. It must look hand-designed, not AI-generated.

**Not in scope unless the owner explicitly approves in writing:** changing chess rules, move validation, the skills' gameplay logic, matchmaking, networking, or the data model.

---

## 1. NON-NEGOTIABLE SAFETY RULES (read first, obey always)

The owner has no coding background and cannot debug a broken game. A broken game is the worst possible outcome. Follow these rules before every action.

1. **Back up first.** Before touching anything: confirm the project is in git. If not, run `git init` and commit everything. Create the branch `redesign/wooden-theme` and a tag `pre-redesign-backup` on the untouched code. All work happens on the branch. Never work on main.
2. **Audit before editing.** Phase 1 is read-only. Do not change a single file until `docs/AUDIT.md` is written.
3. **Never modify game logic.** Chess engine, move generation and validation, turn handling, timers' logic, skill effects' logic, networking and state management are **protected files**. List them in the audit. Only touch them if a change is unavoidable, and then only after asking the owner and explaining why in plain language.
4. **Separate looks from logic.** All new visuals go in presentation layers (components, styles, assets, theme tokens). Components must keep receiving the **same props, events and callbacks** they receive today. If a component's interface must change, update every usage in the same commit.
5. **Preserve hooks.** Keep every DOM id, data attribute, class name, event name and function name that logic, tests or analytics rely on. Search the whole codebase before renaming anything. Rename visible text freely, but never rename internal identifiers (for example keep the internal mode id for "Robin Mode" even if the visible label changes).
6. **Never delete. Archive.** Move web3-only and old-theme files to `legacy_web3/` instead of deleting. Ask the owner before permanent removal. Remove web3 libraries from the bundle only in their own commit, after confirming nothing imports them.
7. **Small steps, verified steps.** One kind of change per commit. After each phase run: install, build, lint, type-check (if present), all tests, then launch the game and play. If anything fails, **revert that change immediately** with `git revert` or `git checkout`. Do not stack fixes on top of a broken state.
8. **Tests protect the rules.** If chess-rule tests exist, run them before and after every phase. If none exist, **add** characterization tests first (new files only): opening moves, castling both sides, en passant, promotion, check, checkmate, stalemate, and each skill's behavior, as the game behaves today. Do not edit existing tests to make them pass.
9. **No new dependencies without approval.** Prefer plain CSS, SVG and canvas already in the stack. If a library is truly needed, name it, justify it, state its size, and ask.
10. **No guessing, no faking.** Never invent file contents, test results, or "it works" claims. Prove it with command output and screenshots. If you are unsure about the stack, behavior or a requirement, stop and ask one clear question.
11. **No scope creep.** Do not add features that were not requested. Anything extra goes into `docs/SUGGESTIONS.md`, not into the code.
12. **Leave it runnable at every commit.** The game must build and start at the end of every phase.
13. **Report in plain language.** After each phase, write a short summary a non-developer can understand: what changed, what was tested, what needs a decision.

If a rule conflicts with a task, the rule wins. Stop and ask.

---

## 2. Delivery phases

Complete phases in order. Stop at the end of each phase and report. Do not start the next phase until the current one passes its checks.

### Phase 1: Audit (read-only)
- Detect the stack (framework, bundler, language, state management, styling approach, how the board and pieces are rendered: DOM, SVG, canvas, or images).
- Map the project structure. Classify every file as **Protected logic**, **Presentation**, **Web3-only**, or **Shared**.
- List every screen: home, mode select, abilities select, game screen, marketplace, tournament, spectate, stats, shop, wallet, settings, chat, game over.
- List every web3 dependency and feature: wallet connect, token or crypto prize pool, NFT items, on-chain calls, marketplace, wallet nav tab.
- List every network feature: matchmaking, realtime sync, live chat, spectate, ratings. Note which ones need a backend that will not exist on Playables.
- Find how existing tests run, or note that there are none.
- Output `docs/AUDIT.md` with findings, risks, and a **proposed screen map** for the new design. Ask the owner any open questions.

### Phase 2: Safety net
- Create the branch and tag (rule 1).
- Add characterization tests (rule 8) if needed.
- Record baseline screenshots of every current screen at 3 viewports (see section 9) into `docs/before/`.

### Phase 3: Design tokens and theme system
- Create one theme file (CSS variables or the stack's equivalent) holding all colors, spacing, radii, shadows, textures, fonts and durations from section 3. No hard-coded colors anywhere else.
- Build the theme so board, piece set and table background are **swappable by id** (needed for unlockables in Phase 7).

### Phase 4: Board and pieces
- Build the wooden board and the default piece sets per section 4.
- Wire them to the existing game state **without touching logic**.
- Verify drag, tap-to-move, legal-move hints, captures, castling, promotion, check, and flipped orientation all still work.

### Phase 5: UI components and screens
- Replace every web-style component with the wooden component kit in section 5.
- Rebuild screens per section 6. Keep all navigation and behavior working.

### Phase 6: Skills (power-ups) UI and effects
- Reskin Freeze, Swap and 2nd Chance per section 7 without changing how they work.

### Phase 7: Cosmetics, unlocks and ads
- Add the data-driven unlock system and the ad service abstraction per sections 8 and 9.

### Phase 8: Web3 cleanup and Playables hardening
- Remove or hide all web3 and crypto UI and code paths per section 10.
- Apply the platform checklist in section 11.

### Phase 9: Final QA
- Run the Definition of Done checklist (section 12). Produce `docs/after/` screenshots and `docs/CHANGELOG_REDESIGN.md`.

---

## 3. Visual direction: "Warm Wooden Game Table"

**Concept:** A real chess set on a real table, seen from above, with a clearly 2D flat gameplay plane. Depth comes from **lighting, bevels, grain and soft contact shadows**, not from a 3D engine. No WebGL, no real perspective camera.

**Mood:** warm, tactile, cozy, premium, instantly readable on a phone in bright daylight. High contrast. Bright, clear and animated enough for a casual audience.

### Core palette (use as tokens, adjust only for contrast)
| Token | Hex | Use |
|---|---|---|
| `--walnut-deep` | `#2E1A0F` | Table background, deepest shadows, ebony-side UI |
| `--walnut` | `#5A3720` | Frames, plank panels, buttons (base) |
| `--oak-light` | `#EBD2A5` | Light board squares |
| `--oak-dark` | `#A9733F` | Dark board squares |
| `--ivory` | `#F7EBD2` | White pieces, plaque text on dark wood |
| `--ebony` | `#2A1B13` | Black pieces |
| `--brass` | `#D9A441` | Inlays, active states, coin and reward accents |
| `--felt` | `#2F4A3A` | Optional inset surfaces (score areas, shop shelves) |
| `--good` | `#4E8F5A` | Legal-move marks, success |
| `--danger` | `#B5412F` | Check, resign, errors |
| `--highlight` | `#F2C94C` | Last-move and selected-square tint (about 45% opacity) |

Rules:
- Piece vs square contrast must stay readable on **every** board theme. Check ivory on oak-light and ebony on oak-dark specifically. Add a thin outline or shadow to pieces if needed.
- Text on dark wood: ivory. Text on light surfaces: walnut-deep. Minimum contrast 4.5:1 for body text, 3:1 for large text.
- Never use purple, neon lime, neon glows, gradient mesh backgrounds, glassmorphism or backdrop blur. They are the old web3 look and must disappear completely.

### Typography
- Display and titles: a sturdy, carved, game-appropriate typeface (for example **Alfa Slab One** or similar heavy slab). Use for logo, screen titles, big buttons.
- Body and numbers: a rounded, very legible sans (for example **Nunito** or **Baloo 2**). Use for timers, labels, tooltips.
- Max two families. Self-host the font files (no external font CDN). Subset to needed characters and weights to keep the bundle small.
- Sentence case. Avoid tracked-out all-caps eyebrow labels above everything. Use text size and material, not decoration, to show hierarchy.

### Material language (this is what makes it feel designed, not generated)
- **Wood grain** via a seamless, compressed texture (WebP) or an SVG turbulence filter, with a subtle color variation per square so no two squares look copy-pasted.
- **Bevels and inner shadows**: raised frames, inset squares, engraved coordinates.
- **Brass**: thin metal inlays and rivets on important controls only.
- **Light source**: one consistent light from the top-left across everything (board, pieces, buttons, panels). Highlights top-left, shadows bottom-right.
- Contact shadows under pieces: a soft elliptical shadow offset toward the bottom-right.
- Keep decoration purposeful. One memorable element per screen (the board on the game screen, the logo plaque on home). Everything else stays quiet.

### Anti-slop rules (hard bans)
- No grid of identical rounded cards with identical soft shadows.
- No emoji as UI icons. Use a custom, consistent SVG icon set (same stroke weight, same corner style, drawn to look carved or inlaid).
- No lorem ipsum, "Welcome to the future", crypto language, or marketing filler.
- No default browser controls, no unstyled scrollbars, no `alert()` or `confirm()` dialogs.
- No fade-and-slide-up animation on every element. Use motion deliberately (see below).
- No pill-shaped gradient buttons, no neon outlines, no arrow glyphs appended to every button label.

### Motion
- Piece movement: a quick ease-out slide (about 140 to 220 ms) with a tiny lift and settle (scale or shadow change), plus a wooden "tock".
- Capture: the captured piece is knocked off with a short hop and fades into a small captured tray. No particle explosions.
- Check: the king's square gets a pulsing red inlay ring. Checkmate: a short, clean banner drops in like a wooden plaque.
- Buttons: press moves the button down 2 to 3 px and flattens the shadow. That is all.
- One orchestrated intro on first load (the logo plaque and board settling in). Nothing else animates on its own.
- Respect `prefers-reduced-motion`.

---

## 4. Board and piece specification

### Board
- 8x8 flat 2D board, square, centered, as large as the screen allows (keep 8 to 12 px safe margin).
- Light and dark squares use wood textures with per-square grain variation and a thin dark edge line between squares.
- Outer frame: thick walnut frame with a bevel, an inner inlay line in brass, and rounded outer corners (about 12 to 16 px).
- Coordinates (a to h, 1 to 8) engraved or inlaid on the frame, small but readable, never overlapping pieces. Make them toggleable.
- Selected square: warm yellow tint plus a thin brass inner border.
- Legal moves: soft round dot on empty squares, a ring on capturable pieces. Use `--good` at moderate opacity so it reads on both square colors.
- Last move: both squares tinted with `--highlight`.
- Check: the king's square gets a red radial glow ring.
- Orientation flip supported without visual glitches.

### Pieces (2D sprites with a 3D look)
- Classic **Staunton silhouettes**, clearly distinguishable at 32 px (pawn vs bishop and knight vs rook must read instantly).
- Built as **SVG** (preferred, crisp at any size and tiny in file size) or sprite sheets. One shared SVG structure per piece type so every set stays consistent.
- 3D illusion technique (all done in 2D):
  - base shape with a vertical linear gradient plus a radial highlight on the upper-left
  - a darker rim on the lower-right edge
  - a thin specular streak
  - a contact shadow ellipse under the base
  - a subtle wood-grain overlay clipped inside the silhouette
- Pieces must not be drawn upside down or mirrored for black.
- Drag state: piece lifts (about 1.1x scale), shadow grows and softens, cursor or finger offset so the piece is visible above the finger on mobile.
- Rendering must stay at 60 fps on a low-end phone. Pre-render and cache heavy effects. Avoid per-frame filters.

### Default sets shipped free
- **Board:** Classic Oak (oak-light and oak-dark).
- **Pieces:** Boxwood and Ebony Staunton.
- **Table:** Dark walnut with a soft vignette.

### Unlockable sets (data-driven, see section 8)
Boards: Walnut and Maple, Cherry, Rosewood, Bamboo, Burl, Ebony and Ivory, Golden Maple.
Pieces: Carved Mahogany, Brass-inlaid, Polished Ivory, Smoked Oak, Royal Gold-trim.
Tables: Library desk, Cafe table, Travelers' map table.
Each must pass the contrast check in section 3.

---

## 5. Wooden component kit (replace ALL generic web components)

Build these once as reusable components, then use them everywhere. Remove every old web-style component from the UI.

- **Plank button (primary):** raised wood plank, brass-trimmed edge, large readable label, press animation. Variants: primary (brass accent), secondary (plain wood), danger (red inlay).
- **Medallion button (round):** for icon actions (settings, sound, skills).
- **Plaque panel:** framed wooden or parchment panel for dialogs, info and rewards. Corner studs optional.
- **Toggle / mode switch:** a sliding wooden tab in a carved groove (for Standard / Skills mode).
- **Brass timer plates:** two plates with clear digits, an active-turn glow in brass, a low-time warning in red below 10 seconds.
- **Player strip:** avatar in a round brass-ringed frame, name, rank. Captured pieces tray beside it.
- **Move list:** a simple inset notation panel with readable, tappable rows (collapsible on mobile).
- **Toast / banner:** a small wooden tag that slides in from the top, auto-dismisses.
- **Modal:** a plaque with a dimmed (not blurred) backdrop. Focus trapped, closable, large touch targets.
- **Progress bar:** carved groove with a brass fill, used for unlock progress.
- **Badge and counter:** small brass circle with a number (skill uses left, coins).
- **Icon set:** custom SVG, consistent, carved look. Needed: play, settings, sound on/off, music, home, stats, shop, profile, flip board, undo, draw, resign, freeze (snowflake crystal), swap (two curved arrows), 2nd chance (rewind or hourglass), coin, lock, play-ad (clapper or video), trophy, close, check mark.
- **Loading screen:** the logo plaque with a wooden progress bar. Under 2 seconds on a mid-range phone.

Component rules:
- Minimum touch target 44x44 px. Keyboard focus visible. Labels and ARIA for icon buttons.
- States for every control: default, hover (desktop only), pressed, disabled, focus, loading.
- No component may import web3 code.

---

## 6. Screens

Design **portrait mobile first** (360x640 baseline), then scale up gracefully to tablets and desktop (centered game column, decorative wooden table fills the side space).

1. **Loading:** logo plaque, wood progress bar.
2. **Home:** logo plaque at top. A framed board preview in the middle. A big **Play** plank button. Beneath it a Standard / Skills mode switch and the skill selector (visible only in Skills mode). Secondary plank buttons: **Shop** (cosmetics), **Tournaments** (only if it works without a web3 backend, otherwise hide with a feature flag), **Watch** (only if it works without a backend, otherwise hide). Bottom bar with four wooden tabs: Home, Stats, Shop, Profile. Remove wallet and crypto elements entirely.
3. **Game screen:** opponent strip on top, board centered and dominant, player strip below, timers, a compact skill bar under the board (3 medallions), and action buttons (Draw, Resign, Flip, Settings) in a small tray. Chat is replaced by preset **emote buttons** (for example Good luck, Nice move, Oops, GG) so there is no free-text moderation burden. Never show real-money or crypto prize text. If a "prize" concept is needed, use coins.
4. **Game over:** plaque with result, rating change, coins earned, and buttons: **Play again**, **Home**, and an optional "Watch ad: double coins" button (user-initiated).
5. **Shop / Collection:** shelves for Boards, Pieces, Tables. Each item shows a preview, a lock badge, and its unlock path (watch N ads, or spend coins). Selected item has a brass check. Preview before unlocking.
6. **Stats:** wins, losses, draws, rank, streak. Simple, readable.
7. **Settings:** sound, music, vibration, coordinates on/off, move hints on/off, auto-queen, language (if existing), and credits. Wooden toggles.
8. **Tutorial overlay (first run only):** short, skippable, explaining tap-to-move and skills. 3 steps max.

Copy rules: short, plain, friendly, active voice, sentence case. Buttons say exactly what happens ("Play", "Watch ad to unlock", "Play again"). Errors explain what happened and how to fix it.

---

## 7. Skills (power-ups) UI and effects

Keep the existing logic and rules for every skill. Only redesign how they look, feel and are selected.

- **Skill bar:** three round wooden medallions with custom icons: Freeze, Swap, 2nd Chance. Each shows a uses-left badge. A disabled medallion looks carved-flat and dimmed. An armed (selected) skill glows with a brass ring.
- **Targeting mode:** when a skill is armed, valid target pieces or squares get a clear, readable highlight, and a short instruction plaque appears (for example "Choose a piece to freeze"). A visible cancel button is always available.
- **Freeze effect:** a frosted-ice overlay and small crack lines on the piece's square, a small snowflake badge, and a soft "crystal" sound. No neon blue glow. When the freeze ends, the ice melts away with a short animation.
- **Swap effect:** the two pieces slide past each other along curved paths with a quick wooden clack. Brief brass trail, no sparkle storms.
- **2nd Chance effect:** a rewind swirl on the board while the last move undoes, with a clock-rewind sound.
- **Out of uses:** the medallion shows a play-ad badge. Tapping it offers "Watch ad for 1 extra use" in a plaque. The reward is granted **only** after the rewarded-ad success callback (see section 9).
- Skills must feel balanced and fair. Do not change costs, counts or rules. Only show them.

---

## 8. Unlockables and rewards (data-driven)

Build a single registry file (for example `cosmetics.json` or `cosmetics.ts`) that lists every board, piece set and table:

```
{ id, type: "board" | "pieces" | "table", name, previewAsset,
  unlock: { method: "free" | "ads" | "coins", adsRequired?: number, coinCost?: number } }
```

Rules:
- Adding a new cosmetic must require **only** adding an asset and one registry entry. No code changes.
- Unlock progress (ads watched per item, owned items, equipped items, coins) is saved through the platform storage layer (section 9), with a local fallback.
- Unlocking is **fair and transparent**: show exactly how many ads are needed and the current progress. Never trick users into watching ads.
- Free users must still enjoy the full chess game. Cosmetics and extra skill uses are the only gated items. Never lock core gameplay behind ads.
- Earn coins from playing (small win/draw/loss amounts, configurable in one constants file) so progress feels rewarding even without ads.
- Suggested starting economy (adjustable, keep in one config file): free default set, other boards 1 to 3 ads, premium sets 3 to 5 ads.

---

## 9. Ads and platform SDK layer

Create **one** `AdService` module that is the only code allowed to call any ad or platform SDK. Game and UI code call `AdService` only.

Interface:
```
AdService.init()
AdService.showRewarded(rewardId): Promise<{ rewarded: boolean }>
AdService.showInterstitial(): Promise<void>
AdService.isRewardedAvailable(): boolean
```

Rules:
- Provide **adapters** for Playgama Bridge and the YouTube Playables SDK, plus a **mock adapter** for local development (simulates success, failure and no-fill). Pick the adapter at runtime or build time via one config switch.
- **Reward only when the SDK confirms the reward** (for Playgama Bridge, the rewarded state, not merely "closed"). If the ad fails, closes early, or has no fill, grant nothing and show a friendly plaque: "Ad not available right now. Try again soon."
- **Never show an interstitial at game start.** Show interstitials only at natural breakpoints (after a finished game, when returning to home), with a cooldown (configurable, default 60 seconds or more), and never while a game is in progress.
- **Rewarded ads are always user-initiated** from a clearly labeled button. Never auto-play, never disguise.
- **Pause and mute** game audio and timers while an ad plays, then restore state exactly. Never let a game timer run down during an ad.
- Never block the UI forever. Add timeouts and a failure path.
- Also wrap the platform lifecycle: call the "game ready" signal when the first interactive screen is up, handle pause and resume events from the platform, and use the platform's save and load for persistence (with a safe local fallback when unavailable).
- Before coding, read the **current official docs** for Playgama Bridge and YouTube Playables (SDK, ad, storage, review requirements) and follow them. Requirements change. Do not rely on memory. If docs and this file disagree, the docs win and you note the difference in `docs/AUDIT.md`.

---

## 10. Removing the web3 layer (carefully)

- Hide or replace, in this order: wallet connect button, crypto and token balance, prize pool in tokens, marketplace for NFTs, wallet tab, any "connect" gating on playing.
- Replace the crypto prize concept with in-game coins, and Marketplace with Shop (cosmetics).
- Make Play work with **no wallet and no login** (guest profile stored locally or via platform save).
- Keep a clean internal feature-flag file so any feature that needs a backend can be switched on or off without code changes.
- Move web3 code to `legacy_web3/`. Remove web3 libraries from the bundle in a separate, clearly named commit after the build and tests pass without them.
- Do not leave dead buttons, broken links, console errors or empty screens.

### Multiplayer note (needs the owner's decision, do not act silently)
If matchmaking, live chat or real-time play depends on a backend that will not exist on Playables, **stop and report options** in `docs/AUDIT.md`:
- (a) keep the existing online mode if the backend is hosted and works from the platform sandbox
- (b) add a **play vs computer** mode as a separate, owner-approved task
- (c) hide online features behind a feature flag
Do not delete existing online code. Free-text chat with strangers should not ship; use preset emotes.

---

## 11. YouTube Playables / Playgama readiness checklist

Verify each item against the current official docs before sign-off.

- Game works as a single self-contained web bundle: **no external network calls** for core assets (self-host fonts, images, audio, scripts). No CDN dependencies.
- No external links, no pop-ups, no redirects, no unlicensed assets.
- Total size and load time kept small. Optimize aggressively: WebP or SVG images, short compressed audio, font subsets, code splitting only if the platform allows. Follow the platform's packaging rules (some platforms have rules about file compression and size limits).
- First interactive screen appears fast. Show real content quickly.
- Responsive for portrait and landscape. Touch-first controls. No hover-only interactions. No right-click or keyboard-only requirements.
- Audio starts only after a user gesture. Sound and music toggles persist. Respect the platform's mute and pause events.
- No crashes, no console errors, no unhandled promise rejections. Graceful behavior offline or when the SDK fails.
- No collecting personal data. No sign-in required.
- Content is family-friendly. No crypto, gambling or real-money language anywhere in the UI or store assets.
- Bright, high-contrast, easy-to-read graphics with lively but tasteful animation.
- Add the platform's required "game ready" and lifecycle signals, and test with the platform's test tooling where available.
- Prepare store assets in `docs/store/`: icon, thumbnail, 3 to 5 screenshots, a short description.

---

## 12. Definition of Done (all must be true)

- [ ] Build, lint, type-check and all tests pass. Chess rule tests show no regressions.
- [ ] A full game plays correctly start to finish, including castling, en passant, promotion, check, checkmate, stalemate, draw, resign and timeout.
- [ ] Every skill still behaves exactly as before, now with the new visuals.
- [ ] No purple, neon, glass or blur, no web3 text, wallet UI or crypto language anywhere.
- [ ] Every screen uses the wooden component kit and the single theme token file.
- [ ] Board and pieces look dimensional but remain 2D, readable at small sizes, and contrast-checked on all board and piece combinations.
- [ ] Shop works: preview, lock state, unlock via rewarded ad, equip, and persistence after restart.
- [ ] Ads: rewards only on confirmed reward, interstitials never at start and never mid-game, game pauses during ads, failure paths tested with the mock adapter.
- [ ] Tested at 360x640, 412x915 and 1280x720, plus a short-height landscape phone. No overflow or clipped controls.
- [ ] Keyboard focus visible, reduced-motion respected, touch targets at least 44 px.
- [ ] No console errors. Smooth 60 fps on a mid-range phone profile.
- [ ] `docs/AUDIT.md`, `docs/CHANGELOG_REDESIGN.md`, `docs/before/` and `docs/after/` screenshots, and `docs/SUGGESTIONS.md` exist.
- [ ] A short plain-language handoff summary for the owner: what changed, how to add a new board or piece set, how to switch the ad adapter, how to roll back (`git checkout pre-redesign-backup`).

---

## 13. How to work

1. Read this whole file. Restate the plan in 10 lines or fewer and wait for the owner's go-ahead before Phase 2.
2. Work phase by phase. Commit with clear messages (for example `feat(ui): wooden board component`, `chore: archive web3 files`).
3. After each phase, show screenshots, the test output, and a plain-language summary.
4. When in doubt about anything that could affect gameplay, **stop and ask**. A short question is always better than a broken game.
5. If something breaks, say so honestly, revert, and explain what happened.
