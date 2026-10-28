# Chess Arena

Chess Arena is a free, mobile-first chess game for the web. It combines classic chess with **Tactical Mode** abilities, AI practice, online rooms, matchmaking, chat and rematches.

## Features

- **Practice vs AI** — easy, medium and hard difficulty.
- **Online multiplayer** — random matchmaking or private 6-character room codes.
- **Tactical Mode** — equip two one-use abilities such as Swap, Freeze, Second Chance, Divine Shield and Pegasus Jump.
- **Account-linked player profile** — name, rating, win/loss/draw totals, coins, match history and equipped board. YouTube Playables uses native cloud storage (`YT.getCloudStorage()`); otherwise the PlayGama Bridge store or `localStorage` is used.
- **First-launch onboarding** — new players choose a 3–16 character alphanumeric name once. Existing profiles hydrate the saved name, rating, coins, board and global rank immediately.
- **Global leaderboard** — every finished AI or online match updates the profile, syncs Elo/stats with `POST /api/leaderboard/sync`, and refreshes the player's rank and the leaderboard.
- **Shop** — equip wooden board themes. Soft coins are earned by playing and are only used for hints/undo; there are no purchases or withdrawals.
- **PlayGama Bridge** — optional platform identity hooks for Playables-style hosts. The Bridge `mock` adapter is ignored for identity and cloud data.

## Requirements

- Node.js 18+
- npm

## Run locally

```bash
npm install
npm start
```

Open <http://localhost:3000>.

MongoDB is optional. Without `MONGO_URI` the game still runs, the player profile still saves through the configured cloud/local store, and the leaderboard falls back to an in-process memory table for the life of the server. Create a `.env` file and set `MONGO_URI` (or `MONGODB_URI`) to persist leaderboard profiles across restarts and deployments.

## Player profiles and cloud saves

The client profile is canonical for the player's name, rating, W/L/D totals, coins, equipped board and recent match history. Storage priority is:

1. YouTube Playables native cloud storage from `YT.getCloudStorage()`.
2. PlayGama Bridge storage, when a real (non-`mock`) platform account is present.
3. `localStorage` for localhost and standalone play.

The cloud key is `player_profile`; a local mirror is always written immediately so a quota or network failure cannot destroy progress. Cloud writes are coalesced and limited to at most one write per second, with background retry/backoff. A cloud-backed account whose cloud record is empty is treated as a new player; another account's local mirror is never migrated into it.

The profile schema is:

```json
{
  "playerId": "usr_<16 hex>",
  "username": "PlayerName",
  "rating": 1200,
  "rank": null,
  "stats": {
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "totalMatches": 0,
    "winStreak": 0,
    "bestStreak": 0
  },
  "coins": 1000,
  "equipped": { "board": "classic-oak" },
  "matchHistory": [],
  "lastUpdated": 0
}
```

On first launch the **Enter Player Name** modal asks for 3-16 alphanumeric characters. Existing cloud profiles skip the prompt and hydrate immediately. After each AI or PvP match the cloud profile is updated, `POST /api/leaderboard/sync` refreshes Elo/stats/rank, and the profile badge plus leaderboard summary are repainted.

The sync endpoint treats a strictly larger client total as newer offline progress, but keeps the server's Elo/stats when the incoming total is equal or lower. The client adopts those canonical server values, so closing the tab right after a PvP result cannot erase that result on the next launch.

## Scripts

```bash
npm start   # production server
npm run dev # server with file watching
npm test    # chess engine + economy tests (24 total)
```

## Project structure

```
server.js                 Express + WebSocket server, rooms, matchmaking, stats
models/User.js            Optional MongoDB player profile
public/index.html         All game screens and modals
public/js/app.js          UI controller and local game state (monolithic by design)
public/js/chess-engine.js Chess rules and Tactical Mode abilities
public/js/ai-engine.js    Minimax AI
public/js/multiplayer.js  WebSocket client
public/js/platform.js     PlayGama Bridge identity adapter
public/js/storage-service.js YouTube cloud / Bridge / localStorage profile store
public/js/ad-service.js   Adapter abstraction (mock outside hosted platforms)
public/js/pieces.js       SVG chess piece renderer
public/css/styles.css     Base wooden/gold UI
public/css/wooden-theme.css Theme overrides
public/css/tokens.css     Font/color/spacing tokens
public/assets/            Game art, avatars and SVGs
docs/ARCHITECTURE.md      Runtime and protocol notes
test/                     Engine tests
```

## Keyboard and input

- Click/tap a piece, then a highlighted destination square.
- Drag is supported on desktop and mobile.
- `Escape` closes confirmation dialogs.

## Playables notes

YouTube Playables requires validation of story/orientation guidance and strict build-size limits. The current build references the PlayGama Bridge CDN from `index.html` and uses mock ads when no host ad adapter is present. Native profile persistence uses `YT.getCloudStorage()` when the SDK provides it; the real Playables cloud API cannot be exercised on localhost, so localhost and standalone builds use `localStorage`. Multiplayer needs a hosted WebSocket backend. See `docs/ARCHITECTURE.md` for details and remaining blockers.

## PlayGama publishing checklist

- **Bridge lifecycle:** the game boots immediately, reads `platform.language`, sends `game_ready`, and subscribes to audio and pause state changes. Music, timers and AI are paused with the host.
- **Storage:** real platform sessions use Bridge Storage after Bridge readiness; localhost and standalone sessions fall back to `localStorage`. Progress, settings, ad counters and player stats are saved in one versioned snapshot.
- **Ads:** rewarded ads resolve only on the host `rewarded` event, never on close. Interstitials are shown only at a natural post-game break, never during active PvP gameplay.
- **External calls:** online matchmaking is disabled when the host reports external calls are unsupported. AI and local play remain available.
- **Localization:** the UI is English-only; `document.documentElement.lang` follows `platform.language`. Declare English as the only language in the PlayGama dashboard.
- **Orientation:** portrait and landscape are supported. Short landscape phones use a compact in-game layout that fits the board and action bar without page scrolling.
- **Live deployment:** `https://chess-arena-262t.onrender.com/` is the production URL used for publishing.

Dashboard declarations to make with the submission: English only, portrait and landscape supported, rewarded ads in the shop/ability flow, post-game interstitial, and online modes unavailable when external calls are blocked.

## License

MIT
