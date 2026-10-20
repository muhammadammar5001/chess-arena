# Wooden Chess: Phase 1 Codebase Audit (Web3 to YouTube Playables)

**Date:** October 2026  
**Repository:** Owl's Gambit (Wooden Chess Redesign)  
**Target Platform:** YouTube Playables via Playgama (HTML5 Casual Gaming)  
**Safety Protocol:** Read-Only Audit (No game logic or UI touched)

---

## 1. Technology Stack Analysis

| Component | Current Implementation | Planned Redesign Target |
| :--- | :--- | :--- |
| **Frontend Framework** | Plain Vanilla JavaScript (ES6 Modules / Browser global `window.app`) | Vanilla JS (Zero bloat, instant boot) |
| **Bundler / Build** | None (Direct script tag loading in `index.html`) | Retain direct execution; optimize assets |
| **Styling** | Vanilla CSS (`public/css/styles.css` - 138 KB) | CSS Variables (`tokens.css`) + Wooden Component Kit |
| **Board & Piece Renderer** | DOM-based (`<div class="square">` + `<span class="piece">` with Unicode glyphs) | DOM-based with layered wood textures + SVG Staunton pieces with 2D depth |
| **State Management** | Central controller class `OwlGambitApp` in `public/js/app.js` | Preserved entirely (interfaces & state unchanged) |
| **Chess Engine** | Standalone rule engine `public/js/chess-engine.js` (FIDE + Abilities) | **PROTECTED FILE** - Untouched |
| **AI Opponent** | Minimax engine `public/js/ai-engine.js` with heuristic evaluation tables | **PROTECTED FILE** - Instant-play offline mode |
| **Backend / Networking** | Node.js + Express + `ws` WebSocket in `server.js` | Retain WebSocket for 1v1 over WSS; add offline guest fallback |
| **Database** | SQLite (`database.sqlite`) via `db.js` + optional MongoDB | LocalStorage / Platform Cloud Save (`ytgame.saveData`) |

---

## 2. File & Component Classification

### A. Protected Logic (DO NOT MODIFY GAME LOGIC)
- `public/js/chess-engine.js`: Complete FIDE move validation (castling, en passant, promotion, check/checkmate, stalemate), turn clock, and special abilities (`freeze`, `swap`, `second`).
- `public/js/ai-engine.js`: Computer evaluation tree, minimax search, and bot move generator.
- `server.js` (Game State & Match Engine): Room coordination, turn validation, countdown clocks, rematch handling.

### B. Presentation Layer (Subject to Wooden Redesign)
- `public/index.html`: UI structure, screens, modals, dialogs. All DOM element IDs and data attributes will be preserved.
- `public/css/styles.css`: Currently contains dark purple (`#13091e`), neon lime (`#a3e635`), glassmorphism cards, and crypto glows. To be superseded by warm wooden tokens.
- `public/assets/`: Banners, avatars, icons. To be replaced with tactile wood, brass, parchment, and Staunton SVG pieces.

### C. Web3-Only Files (To be safely archived in `legacy_web3/`)
- `contracts/`: Complete Hardhat project (`GameEscrow.sol`, deployment scripts, smart contract tests).
- `public/js/app.js` (Web3 routines): `connectWallet()`, `checkWalletBalance()`, `confirmStake()`, `claimPrize()`, Phantom/Solana listeners.
- `server.js` (Web3 escrow verification): USDT staking listeners, transaction signature checks, escrow payouts.

### D. Shared / Controller
- `public/js/app.js`: Connects DOM events, renders squares and pieces, manages screen transitions.
- `public/js/multiplayer.js`: Manages WebSocket client connections and packet dispatch.
- `db.js`: Database layer for usernames, stats, and rankings.

---

## 3. Screen Inventory & Proposed Transformation

| Screen ID | Current Purpose (Web3) | Redesigned Purpose (YouTube Playables) |
| :--- | :--- | :--- |
| `screen-home` | Neon dashboard with wallet connect & owl banner | Warm tabletop with carved wooden logo, quick **Play** plank button, mode toggle |
| `screen-stake` | USDT Wager selection ($1, $5, $10, custom) | Converted to virtual coin stakes or bypassed for instant match |
| `screen-ai-select` | Play against AI bot (Novice to Master) | Retained as instant Single-Player practice mode |
| `screen-room` | Custom Room code creation & friend join | Retained for 2-player friend matches via shareable room code |
| `screen-matchmaking` | Mode cards (Random PvP, Friend, AI) | Streamlined into clean wooden selection plaque |
| `screen-waiting` | Match search with radar spinner | Wooden hourglass / clock spinner with cancel plank button |
| `screen-game` | Purple board with unicode pieces & wager header | 8x8 Beveled Walnut/Oak board, brass coordinate inlay, Staunton SVG pieces, brass timer plates |
| `screen-abilities` | Neon loadout selector for skills | Carved wooden medallions displaying Freeze, Swap, and 2nd Chance |
| `screen-profile` | Wallet public key, SOL/USDT balance, stats | Guest profile plaque, carved avatar, win/loss stats, virtual coin tally |
| `screen-shop` | NFT characters & item marketplace | Cosmetics collection (Unlockable wooden boards, piece sets, tables via coins/ads) |
| `screen-howto` | Text modal explaining moves | Illustrated 3-step tactile tutorial overlay |
| `screen-leaderboard` | Global player rankings | Wooden leaderboard plaque with brass ranks |
| `screen-victory` | Game Over / Prize claim screen | Plaque showing match result, rating change, coins won, and "Watch Ad to Double" button |
| Modals (Settings, Draw, Resign) | Dark purple blurred popups | Wooden plaques with brass rivets and clear tactile buttons |

---

## 4. Web3 Decommissioning Strategy
1. **Wallet Connection:** Replaced with auto-generated guest profiles (e.g., "Grandmaster Owl #421") saved in `localStorage` or YouTube Playables Cloud Save.
2. **Real-Money Betting:** Removed entirely. All references to USDT, SOL, wagering, and prize pools will be replaced with **Gold Coins** earned from playing and completing matches.
3. **NFT Ownership Checks:** Replaced with local and cloud-saved cosmetic inventory managed via `cosmetics.json`.
4. **Archiving:** All Web3 files and dependencies will be moved to `legacy_web3/` rather than deleted, keeping the codebase clean and git-traceable.

---

## 5. YouTube Playables & Playgama Readiness
- **Zero External CDNs:** Self-host all fonts, sounds, and SVGs to comply with iframe sandbox rules.
- **Responsive Viewports:** Target baseline 360x640 (portrait mobile), 412x915 (modern tall mobile), and 1280x720 (desktop tablet).
- **Ad Service Architecture:** Create `AdService.js` with:
  - `showRewarded(rewardId)` (for extra skill use or double coins)
  - `showInterstitial()` (at natural game-over breakpoints, with >=60s cooldown)
  - `MockAdAdapter` for seamless local testing without live ads.
- **Audio Lifecycle:** Audio pauses when game is backgrounded or YouTube video is toggled.

---

## 6. Testing Strategy
- **Characterization Tests:** Create `test/chess-rules.test.js` validating:
  - Standard pawn moves, double push, en passant.
  - Castling (kingside and queenside) for both white and black.
  - Piece moves (knight jumps, bishop diagonals, rook ranks/files, queen mobility).
  - Promotion to queen, rook, bishop, knight.
  - Check, checkmate, stalemate, and draw conditions.
  - Ability verification (Freeze immobilizes piece for 2 turns; Swap trades positions; 2nd Chance rewinds).
- Run this test suite before and after every phase to guarantee zero regressions.

---

## 7. Open Questions for Owner
1. **Multiplayer Default:** Should the primary "Play" button launch an instant match against the Computer (AI) or search for an Online PvP match? (Recommendation: Offer Quick Match with instant AI fallback if no player connects within 5 seconds).
2. **Audio:** Should we introduce classic crisp wooden acoustic sounds for piece moves, captures, check, and button presses?
