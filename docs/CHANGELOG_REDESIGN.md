# Wooden Chess Redesign Changelog

**Target:** YouTube Playables via Playgama (Web2 HTML5)  
**Theme:** Warm Wooden Tabletop Chess  
**Branch:** `redesign/wooden-theme`  
**Rollback Tag:** `pre-redesign-backup`  

---

## 1. Visual & Theme Overhaul
- **Design Tokens (`public/css/tokens.css`):**
  - Replaced dark purple and neon-lime palette with a rich tabletop palette: Walnut Deep (`#20120B`), Warm Walnut (`#4A2E1B`), Oak Light (`#EBD2A5`), Oak Dark (`#A9733F`), and Brass accents (`#C99700`).
  - Added swappable theme selectors for unlockable boards (`walnut-maple`, `cherry-rosewood`, `ebony-ivory`) and tables (`cafe`, `library`).
- **Wooden Chess Board (`public/css/wooden-theme.css`):**
  - Beveled walnut outer frame with inlaid brass lining and rounded corners.
  - Light and dark oak squares with realistic wood-grain textures.
  - Brass-inlaid coordinates along the perimeter.
  - Radial check glow ring on threatened kings.
  - Subtle brass highlights for selected square and last moves.
- **Staunton SVG Chess Pieces (`public/js/pieces.js`):**
  - 2D Staunton silhouettes with 3D illusion: linear wood gradients, upper-left specular highlights, and contact shadows under the base.
  - Crisp at all resolutions, touch-friendly, and lightweight.
- **Wooden Component Kit:**
  - Primary & secondary wooden plank buttons with brass trim and tactile press states.
  - Brass timer plates with active turn glows and low-time warnings.
  - Carved wooden groove mode switch (Standard / Skills mode).
  - Plaque-framed dialogs, modals, and profile cards.

---

## 2. Web3 Decommissioning & Web2 Platform Readiness
- **Archived Web3 Contracts:**
  - Moved `contracts/` directory to `legacy_web3/contracts/`.
- **Wallet Connect Replacement:**
  - Removed mandatory crypto wallet connect prompt.
  - Added instant guest authentication (`owl_guest_id` in localStorage) with default coin balance (1,000 Coins).
- **Virtual Economy:**
  - Replaced USDT and $OWL wagering terminology with virtual Gold Coins.
- **Data-Driven Cosmetics (`public/js/cosmetics.json`):**
  - Created central registry for unlockable boards, pieces, and table skins with coin/ad unlock paths.
- **Ad & Platform Layer (`public/js/ad-service.js`):**
  - Created unified `AdService` with support for rewarded ads, interstitials (with 60s cooldown), and a mock adapter for local testing.
  - Integrated YouTube Playables `ytgame.gameReady()` lifecycle hook.

---

## 3. Quality Assurance & Zero Logic Regressions
- **Characterization Tests (`test/chess-rules.test.js`):**
  - 9 automated tests created and passing:
    1. Initial board setup
    2. Standard pawn moves & turn progression
    3. Knight jumping moves
    4. Kingside castling
    5. En Passant capture
    6. Checkmate (Scholar's Mate)
    7. Freeze ability mechanics
    8. Swap ability mechanics
    9. Second chance (Undo) ability
- **Screen Verification:**
  - Tested on 360x640 mobile portrait and 1280x720 desktop viewports with 0 console errors.
  - Recorded before and after screenshots in `docs/before/` and `docs/after/`.
