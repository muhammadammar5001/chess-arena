---
name: owls-gambit-full-stack-builder
description: ARCHIVED pre-rebrand web3 specification. Do not use for the shipped Chess Arena app; see README.md and docs/ARCHITECTURE.md instead.
version: 1.0.0
---

> **Archived:** This document describes the pre-rebrand Owl's Gambit web3 prototype. It is not part of the shipped Chess Arena app and must not be used as an implementation source of truth. The shipped game uses YouTube Playables cloud storage, optional MongoDB profiles, and local/PlayGama fallbacks documented in `README.md` and `docs/ARCHITECTURE.md`.

# Owl's Gambit - All-in-One Antigravity Build Skill

## 0. Mission

You are the lead product engineer, game systems engineer, smart-contract engineer, security engineer, QA engineer, DevOps engineer, and technical project manager for **Owl's Gambit**, the PvP chess game connected to the **Robin Owls** NFT ecosystem.

Your job is to turn this specification into a production-quality web game and supporting infrastructure.

Do not treat this as a simple landing-page project. The target is a real playable product with:

- Standard competitive chess.
- Robin Mode with limited-use special abilities.
- NFT-holder utility.
- Referral-based game access.
- Paid-match infrastructure where legally permitted and explicitly enabled.
- Tournament infrastructure.
- Profiles, ratings, match history, replays, achievements, and cosmetics.
- Secure server-authoritative real-time gameplay.
- Robinhood Chain NFT integration.
- Optional onchain match settlement architecture.
- Optional future reward-token architecture, kept disabled until economics and compliance are approved.
- Admin/moderation tools.
- Analytics and observability.
- Automated tests and CI.
- Smart-contract tests, deployment scripts, verification, and security controls.

Do not attempt to finish the entire system in one uncontrolled coding pass. Work in milestones, keep the app runnable after every milestone, and never mark a feature complete merely because the UI exists.

---

# 1. Source of Truth and Conflict Rules

This file is the current product and engineering specification.

The original Based Owlets lightpaper is historical reference material. It contains the original game concepts, but several rules were subsequently refined. In particular:

- `Undo Move` is superseded by **Second Chance**.
- The old Fair Play Refund concept based on automatically refunding a player after a disconnect is superseded by a **reconnection-window and abandonment system**.
- The old referral example that split an opponent's fee directly among player/referrer/team is superseded by a **referral reward funded from the platform/referral allocation**, not from an opponent's stake.
- The old promise of a freely tradeable game token is not a production commitment. A token is optional and must remain disabled until tokenomics, legal/compliance review, distribution, liquidity, security and anti-abuse requirements are approved.
- NFT powers are for **Robin Mode**, not standard chess.

The historical lightpaper described three abilities, NFT-holder perks, referrals, paid matches and a fair-play refund. fileciteturn3file0

Never silently restore an old rule because it appeared in the original PDF.

If a later owner instruction explicitly changes a rule, update the configuration/spec first and then implement the change across frontend, backend, tests and documentation.

Never invent missing business values such as final mint prices, final payout percentages, tournament prize pools, token supply, token price, launch dates, or final contract addresses. Keep them as configuration/TBD until explicitly approved.

---

# 2. Product Identity

## Project

**Robin Owls**

## Game

**Owl's Gambit**

## Core positioning

A collectible owl universe with a competitive PvP chess game at its center.

The NFT is not the game itself. The NFT is an identity/access object inside the broader Robin Owls ecosystem.

Core loop:

**Own the Owl -> Enter Robin Woods -> Challenge Players -> Choose Your Strategy -> Play -> Win -> Earn Gameplay Progress -> Unlock More Experiences**

The game should feel like an actual product, not a Web3 skin placed over a chessboard.

---

# 3. Brand and Visual Direction

The existing Robin Owls visual direction is playful 2D cartoon fantasy with light and dark areas mixed together.

Primary palette:

- `#101130` deep navy
- `#0F0F0F` near-black
- `#2A2A2A` dark gray
- `#B5B0FF` lavender
- `#DCEEFE` pale blue
- `#FFFFFF` white
- `#CCFF00` / `#CEFF00` lime accent

Important:

- Do not turn the product into a neon cyberpunk UI.
- Lime is an accent, not the dominant background color.
- Avoid constant gradients.
- Use light backgrounds in marketing/discovery surfaces and dark surfaces where game focus benefits from contrast.
- Keep the owl art flat, vector-like, outlined, expressive and readable.
- Do not use 3D-rendered NFT artwork.
- Do not use fake photorealistic screenshots.
- Prototype art must be clearly presented as a prototype/development preview when it is not an actual game screenshot.

The existing game UI exploration contains six core screens: Home, Matchmaking, In-Game Chess, Abilities, Profile, and Match Result. The in-game screen includes player panels, ratings, timers, an owl-themed chessboard, move history and action controls; the abilities screen uses the three abilities and the `Choose 2 Abilities` flow; the profile screen shows rating, wins/losses, win rate, recent matches and achievements. fileciteturn3file8

---

# 4. Product Modes

## 4.1 Classic Chess

Purpose: pure competitive chess.

Rules:

- Standard chess movement and game-ending rules.
- No Robin Mode abilities.
- Server-authoritative move validation.
- Timed and untimed formats can be configured.
- Ratings can be separated from Robin Mode ratings.

This mode exists so the game can honestly support traditional chess.

## 4.2 Robin Mode

Purpose: chess with limited tactical abilities.

Rules:

- Normal chess rules remain the base rules.
- Special abilities are explicitly enabled.
- Abilities are selected before the match starts.
- Each ability has strict per-match limits.
- The server validates every ability action.
- The UI must clearly display when a position is affected by an ability.
- Both players must see the same resulting board state.

The original concept was that NFT holders could select two of three abilities. fileciteturn3file3

Production recommendation:

- NFT holder: choose **2 of 3** abilities.
- Non-NFT referred/free-access player: choose **1 of the same 3** abilities.
- In any future fully competitive/ranked variant where strict competitive parity is required, give both players the same number of selectable abilities even if NFT holders still retain cosmetic/utility perks elsewhere.
- Paid competitive matches must clearly disclose whether an asymmetric NFT advantage is enabled before entry is committed.

Do not hide asymmetric rules in fine print after a player has paid.

---

# 5. Robin Mode Abilities - Final Production Rules

## 5.1 Second Chance

Purpose: allow limited correction immediately after a move.

Exact rules:

- One use per player per match.
- Only available immediately after the player's own normal chess move.
- Only available before the opponent makes their next move.
- When used, the board reverts to the state immediately before that player's most recent move.
- The player must then submit a legal alternative move.
- The previous move is not counted as the final committed move.
- Once the opponent has responded, the previous move is permanent.
- Opponent receives an immediate visible notification.
- The server stores the original move, rollback event, replacement move and timestamps in the match event log.
- The ability cannot rewind multiple turns.
- The ability cannot rewind after resignation, timeout, checkmate or match finalization.

This supersedes the historical `Undo Move` wording. The old document allowed undoing the last move while the turn remained available; the production version makes the rollback boundary explicit. fileciteturn3file6

## 5.2 Piece Freeze

Purpose: temporarily disable one opposing piece as a tactical action.

Exact rules:

- One use per player per match.
- King cannot be frozen.
- The selected piece remains on the board and can still be captured.
- A frozen piece cannot make a normal move or capture while frozen.
- Freeze duration: **1 opponent turn** for the initial production configuration.
- The opponent is notified immediately.
- Freeze cannot be used after match finalization.
- The server must reject any attempt to freeze a King.
- The server must reject any state that would create an invalid game state under the Robin Mode rules.
- Freeze state is included in the canonical match snapshot and replay events.
- The ability must not silently bypass check rules.
- If testing reveals that freezing a checking piece creates confusing or degenerate states, add a rule disallowing freeze on a piece currently giving check and expose that rule in the UI.

The original concept described temporarily immobilizing an opponent piece and notifying the opponent. fileciteturn3file4

## 5.3 Tactical Swap

Purpose: create a controlled tactical repositioning mechanic.

Exact rules:

- One use per player per match.
- Only two pieces belonging to the activating player can be selected.
- King cannot be selected.
- Tactical Swap consumes the player's action for that turn. It does **not** permit a free swap followed by a normal chess move in the same turn.
- After the swap, the server validates the resulting board state.
- The player's King may not be left in check by the swap.
- The opponent is notified immediately.
- Castling rights and en-passant state must be handled deterministically by the rules engine. Recommended initial behavior: a swap clears castling rights for affected rooks/king context and clears en-passant state for that turn unless the variant engine defines a stricter rule.
- The event must be replayable.
- The resulting position is a Robin Mode state, not a standard chess position generated only by ordinary moves.

The historical document allowed swapping any two own pieces during a turn. fileciteturn3file1

Never implement Tactical Swap as a client-side animation that bypasses the chess engine.

---

# 6. Ability UX

Before entering Robin Mode:

1. Show `Choose Your Abilities`.
2. Show all available abilities.
3. Clearly display remaining uses.
4. Explain the effect in one sentence.
5. Explain any restrictions.
6. Require confirmation.
7. Lock the selected configuration once the match begins.

During the match:

- Abilities appear in a dedicated action bar.
- Used abilities become disabled.
- The server decides whether an ability is legal.
- The UI displays a clear notification after use.
- The move history includes ability events such as `SECOND_CHANCE`, `FREEZE`, `TACTICAL_SWAP`.

Never let users accidentally activate an ability from a hover-only control.

---

# 7. Game Access

Default access model:

### NFT holders

Full access to eligible game modes.

### Referred non-NFT players

Access to designated game modes through a valid referral relationship.

### Public/free players

The exact public access policy remains configurable.

The historical design granted NFT holders access and allowed them to invite non-holders through referral links. fileciteturn3file2

Do not lock the entire game behind NFT ownership if the product is supposed to grow a competitive player base.

---

# 8. Match Lifecycle

Every match must move through explicit server states.

Recommended state machine:

`CREATED -> WAITING_FOR_PLAYERS -> READY -> ACTIVE -> PAUSED_FOR_RECONNECT -> ACTIVE -> COMPLETED`

Alternative terminal states:

- `RESIGNED`
- `TIMEOUT`
- `ABANDONED`
- `CANCELLED_SYSTEM_FAILURE`
- `DISPUTED`
- `VOID`

Never infer state only from the UI.

The database and server are authoritative.

---

# 9. Real-Time Architecture

Recommended architecture:

### Client

- React + TypeScript.
- Next.js or another production-ready React framework.
- Tailwind CSS or equivalent utility styling.
- viem + wagmi for wallet/onchain interaction.
- WebSocket/Socket.IO client for live matches.

### Server

- TypeScript/Node.js.
- WebSocket/Socket.IO or another robust realtime transport.
- Authoritative game service.
- PostgreSQL for persistent data.
- Redis for presence, matchmaking queues, rate limiting and ephemeral state where useful.

### Chess engine

Use a well-tested chess rules implementation such as `chess.js` for the standard rules layer, then build an explicit Robin Mode variant layer around it.

Do not modify third-party chess logic without tests.

### Why server authoritative

Never trust these values from the browser:

- move legality
- timers
- match result
- ability eligibility
- rating changes
- winner
- payouts
- referral qualification
- NFT ownership snapshot used for privileged gameplay

The client sends an action. The server validates the action against the canonical match state.

---

# 10. Canonical Match State

Every active match should have a versioned canonical state containing at minimum:

- match ID
- mode
- white player ID
- black player ID
- player wallet addresses when needed
- current turn
- board FEN/state representation
- move list / PGN-compatible history
- ability selections
- ability usage counts
- active freezes
- clocks
- increment if used
- last move timestamp
- sequence number
- state version
- match status
- reconnect status
- server timestamp
- result, when final

Every mutation increments a monotonic sequence number.

Client commands must contain:

- match ID
- current sequence number
- action type
- action payload
- request ID / idempotency key

Reject stale commands.

---

# 11. Anti-Cheat Architecture

The game must be designed so that a cheater cannot simply modify JavaScript and submit an illegal move.

Required controls:

- Server-side move validation.
- Server-side ability validation.
- Server-side clock authority.
- Server-side result authority.
- Move sequence numbers.
- Replay event log.
- Rate limits.
- Request signatures/secure sessions where appropriate.
- Immutable match results after settlement unless dispute flow reopens them.
- Suspicious behavior logging.
- Admin audit trail.

Optional anti-cheat layers:

- Stockfish analysis for post-match statistical review.
- Engine-correlation analysis.
- Impossible-action detection.
- Repeated account/device/IP correlation.
- Browser integrity heuristics.
- Velocity/rate anomaly detection.

Never auto-ban a player using a single weak signal. Use a review state and evidence log for serious sanctions.

---

# 12. Disconnect and Fair Play Protection

Do **not** attempt to determine whether a player deliberately switched off their Wi-Fi.

A server cannot reliably distinguish:

- router deliberately powered off
- Wi-Fi accidentally dropped
- ISP outage
- laptop sleep
- browser crash
- app closed
- network handoff

Treat them consistently through reconnection rules.

## Production flow

### Step 1: connection lost

Server stops receiving heartbeat/presence signals.

Mark player:

`DISCONNECTED`

### Step 2: reconnect window

Show opponent a visible reconnect timer.

Initial configuration:

**45 seconds**.

Keep the exact value configurable.

### Step 3: reconnect

If the player returns before the timer expires:

- restore the canonical state
- restore the correct clock
- continue the match
- record disconnect duration

### Step 4: timeout to reconnect

If the player fails to reconnect:

- mark match as `ABANDONED`
- apply the match's abandonment loss rule
- finalize the appropriate rating result
- do not issue a generic automatic refund merely because the client disappeared

### Step 5: verified system outage

If the game service itself experiences a verified outage that materially affects the match:

- classify as `CANCELLED_SYSTEM_FAILURE`
- protect the players according to the match's published rules
- if a paid entry fee was escrowed, issue the appropriate contract/refund action

This replaces the old lightpaper's 40% player / 50% opponent / 10% team disconnect-refund formula. The old rule is easy to exploit because a losing player could voluntarily terminate their own connectivity. fileciteturn3file0

---

# 13. Paid Match Architecture

Paid PvP must be treated as a separate economic subsystem, not embedded directly into the chess UI.

Important rule:

**Do not put every chess move onchain.**

Recommended architecture:

`Offchain Match Server -> Signed Match Result -> Onchain Escrow Settlement`

The game is realtime offchain.

Only the economic settlement needs to touch the blockchain.

## Settlement model

For a paid match:

1. Player selects match type and displayed fee.
2. Player commits the required entry amount.
3. Match is created with a unique match ID.
4. Both players fund the match/escrow according to the selected payment architecture.
5. Match is played offchain.
6. Server finalizes the result.
7. Authorized settlement signer creates an EIP-712 signed result.
8. Settlement contract verifies the result and replay nonce.
9. Contract distributes funds according to the match configuration.
10. Settlement event is indexed and shown in the player's history.

Do not let the frontend decide how much money is paid out.

---

# 14. Paid Match Economic Rules

The historical lightpaper proposed entry fees and a winner share of the opponent's entry fee, plus an allocation to the team. fileciteturn3file1

Do not hardcode the old `95%` formula into production.

Use configurable basis-point parameters, for example:

- `platformFeeBps`
- `winnerShareBps`
- `referralShareBps`
- `tournamentAllocationBps`
- `rewardReserveBps`

Require these values to sum correctly for the chosen match type.

Default MVP recommendation for a prototype:

- Winner receives their own stake back + the configured share of the opponent stake.
- Platform fee is deducted from the opponent-side prize pool.
- No automatic onchain token reward is required for losers.
- Optional loser rewards can initially be offchain points/XP instead of a tradable token.

The exact percentages must be stored in one configuration source and displayed before the player commits funds.

---

# 15. Legal / Compliance Gate for Paid Matches

Before enabling real-money matches or a tradable reward token, stop and require explicit legal/compliance review for the target jurisdictions.

Reasons:

- paid head-to-head competitions can trigger gaming, gambling, prize-contest, consumer-protection, payments, AML/KYC or money-transmission obligations depending on jurisdiction and structure
- tokenized rewards can add securities/financial-product, consumer, tax or virtual-asset considerations depending on implementation
- age restrictions may be required

The engineering system must therefore support:

`PLAY_MONEY_MODE = true`

by default.

Real-value settlement stays disabled until the owner explicitly enables it after the relevant legal/compliance review.

Never write marketing copy that implies guaranteed income or investment returns.

---

# 16. Referral System - Final Production Design

The referral system should be simple, understandable and economically safe.

## Goal

Allow Robin Owls NFT holders to invite non-NFT users and receive a referral benefit when the referred user becomes a real active player.

The old lightpaper example split 40% / 50% / 10% of an opponent's fee among multiple parties. fileciteturn3file5

Do not implement that old formula.

## New model

### A creates a referral link

Example:

`game.example/join/OWL123`

The link contains a referral code, not an arbitrary wallet payout promise.

### B joins

B registers and is associated with A's referral code.

The server stores:

- referrer user ID
- referred user ID
- referral code
- timestamp
- attribution status
- qualification status

### Qualification

Do not reward the referrer merely because someone clicked a link.

A referred user must satisfy the defined qualification rules.

Suggested initial qualification:

- complete account onboarding
- pass wallet/session verification where required
- complete at least 3 legitimate matches
- no suspicious self-referral signals
- no duplicate/refund abuse

### Reward

The referrer receives a configurable share of the **platform/referral allocation**, not money removed from the opponent's prize share.

Suggested default:

`referralShareOfPlatformFee = 20%`

This means:

- Player B plays a qualifying paid match.
- The platform fee is calculated normally.
- A configurable fraction of the platform fee is credited to A's referral balance.
- B's opponent is not charged an extra referral fee.
- The reward can be subject to daily, weekly or campaign caps.

For free/play-money modes, referral rewards can be points, XP or cosmetic progress rather than cash.

## Referral anti-abuse

Prevent:

- self-referrals
- wallet cycling
- fake accounts
- multiple referral codes on one account
- repeated signup farming
- bot-generated matches
- coordinated low-effort matches
- wash activity

Referral attribution should be immutable after qualification unless an admin/moderation process changes it.

## Onchain referral rewards

Do not make one smart-contract transaction for every referral event.

Preferred architecture:

`Server qualification -> Merkle/Merkle-like reward root -> User claim`

This reduces gas usage and creates a clean claimable accounting layer.

---

# 17. NFT Holder Perks

NFT utility should focus on identity, gameplay access, customization and community privileges, not promises of financial return.

## 17.1 NFT Avatar

A holder can use their Robin Owl NFT as an in-game identity/avatar.

The game must read ownership from the configured NFT contract on the supported chain.

The server should cache ownership for performance but periodically revalidate it.

## 17.2 Full Robin Mode Ability Choice

NFT holders can choose 2 of the 3 Robin Mode abilities in the production configuration.

The game should verify holder status at match entry.

## 17.3 Exclusive Tournaments

Holder-only tournaments can have:

- limited slots
- private registration
- special cosmetics
- exclusive titles
- special prizes
- seasonal access

The old lightpaper explicitly included holder-exclusive tournaments. fileciteturn3file1

## 17.4 Exclusive Cosmetics

Examples:

- board skins
- piece skins
- move effects
- profile borders
- victory animations
- titles/badges
- lobby backgrounds

Cosmetics should not affect Classic Chess balance.

## 17.5 Priority Support

Create a support-priority label for verified holders.

Do not promise instant or guaranteed response times unless the team can support them.

## 17.6 Holder Events and Rewards

Possible future benefits:

- holder quests
- community tournaments
- merchandise access
- limited collectibles
- seasonal events
- special in-game drops

Only publish a specific reward after its funding, supply and delivery process is actually approved.

The historical document included VIP support, in-game items, holder tournaments and token airdrops. fileciteturn3file1

Token airdrops remain optional and are not a current implementation commitment.

---

# 18. Profile System

Every player should have a profile containing:

- username
- wallet connection state
- avatar
- NFT Holder badge where verified
- rating
- wins
- losses
- draws
- win rate
- Robin Mode record
- Classic record
- recent matches
- achievements
- cosmetics
- titles
- referral status

The existing UI exploration used rating, wins, losses, win rate, recent matches and achievements. fileciteturn3file4

Do not expose private moderation information in the public profile.

---

# 19. Rating System

Use separate ratings for:

- Classic Chess
- Robin Mode

Recommended baseline:

- Glicko-2 or a well-tested Elo-style implementation.

Keep rating changes server-authoritative.

Do not change ratings for:

- cancelled matches
- verified system failures
- invalid/disputed matches until resolved

Store rating snapshots per match for replayability.

---

# 20. Matchmaking

Inputs:

- game mode
- rating range
- time control
- stake bucket if paid mode
- region/latency where available
- ability-rule version

Matchmaking queue states:

- searching
- matched
- opponent confirming
- ready
- started
- cancelled

Anti-abuse:

- avoid repeated immediate rematches where appropriate
- rate limit queue spam
- do not allow one wallet to occupy multiple incompatible queue positions unless explicitly supported

---

# 21. Time Controls

Make time controls data-driven.

Initial presets can include:

- Blitz
- Rapid
- Custom

Each match stores:

- starting time
- increment
- server timestamp
- remaining clock per player

The browser clock is only a visualization.

The server calculates authoritative time.

---

# 22. Match Replay

Every match must be replayable.

Store an append-only event stream such as:

- match created
- players joined
- ability selected
- move submitted
- move accepted
- second chance used
- freeze used
- tactical swap used
- disconnect
- reconnect
- timeout
- resignation
- result finalized

Generate PGN-compatible output for ordinary moves plus Robin Mode extension events.

Replay should reproduce the exact board state at every event sequence.

---

# 23. Database Model

Recommended entities:

## User

- id
- username
- walletAddress
- createdAt
- status
- lastSeenAt

## Wallet

- id
- userId
- chainId
- address
- verifiedAt
- isPrimary

## NFTOwnershipSnapshot

- id
- walletAddress
- collectionContract
- balance
- blockNumber
- checkedAt

## Match

- id
- mode
- rulesVersion
- whitePlayerId
- blackPlayerId
- status
- timeControl
- createdAt
- startedAt
- endedAt
- winner
- terminationReason
- sequenceNumber
- escrowId if applicable
- economicConfigVersion if applicable

## MatchEvent

- id
- matchId
- sequence
- eventType
- payload
- actor
- serverTimestamp
- hash/checksum if useful

## MatchAbility

- matchId
- playerId
- ability
- selectedAt
- usesAllowed
- usesRemaining

## Rating

- userId
- mode
- rating
- rd/confidence if Glicko
- volatility if applicable
- updatedAt

## MatchRatingChange

- matchId
- userId
- before
- after
- delta

## Referral

- code
- referrerUserId
- referredUserId
- createdAt
- qualifiedAt
- status

## ReferralReward

- id
- referralId
- sourceEvent
- amount
- currencyType
- status
- claimEpoch

## Tournament

- id
- mode
- rulesVersion
- entryType
- maxPlayers
- prizeConfig
- status
- registrationOpenAt
- registrationCloseAt
- startAt

## TournamentEntry

- tournamentId
- userId
- seed
- status

## Cosmetic

- id
- type
- metadata

## UserCosmetic

- userId
- cosmeticId
- source
- acquiredAt

## Achievement

- id
- key
- metadata

## UserAchievement

- userId
- achievementId
- unlockedAt

## SupportTicket

- id
- userId
- priority
- status
- category
- createdAt

## AdminAuditLog

- actor
- action
- entityType
- entityId
- before
- after
- createdAt

Never store secrets in the database.

---

# 24. API / WebSocket Contract

Use versioned APIs.

Example REST endpoints:

`POST /api/v1/auth/nonce`
`POST /api/v1/auth/verify`
`GET /api/v1/me`
`GET /api/v1/me/nfts`
`POST /api/v1/referrals`
`GET /api/v1/referrals/me`
`POST /api/v1/matches`
`GET /api/v1/matches/:id`
`GET /api/v1/matches/:id/replay`
`POST /api/v1/tournaments/:id/register`
`GET /api/v1/leaderboard`
`GET /api/v1/health`

WebSocket examples:

`match:join`
`match:state`
`match:action`
`match:move`
`match:ability`
`match:clock`
`match:disconnect`
`match:reconnect`
`match:result`

Do not let the client mutate match state through arbitrary object patches.

Use explicit commands such as:

```text
MAKE_MOVE
USE_SECOND_CHANCE
USE_FREEZE
USE_TACTICAL_SWAP
RESIGN
OFFER_DRAW
ACCEPT_DRAW
CLAIM_TIMEOUT
```

---

# 25. Smart Contract Architecture

Robinhood Chain is EVM-compatible. Current official documentation lists:

- Mainnet chain ID: `4663`
- Testnet chain ID: `46630`
- Mainnet public RPC: `https://rpc.mainnet.chain.robinhood.com`
- Testnet public RPC: `https://rpc.testnet.chain.robinhood.com`
- Mainnet explorer: `https://robinhoodchain.blockscout.com`
- Testnet explorer: `https://explorer.testnet.chain.robinhood.com`
- Mainnet native gas token: ETH

Robinhood's current developer docs recommend using a production infrastructure provider such as Alchemy and say standard Ethereum tooling including Hardhat, Foundry, ethers.js, viem and Wagmi works on the chain. They also recommend deploying to testnet first. citeturn708898search0turn708898search1turn708898search2

Use current official network configuration at implementation time rather than copying stale values from random tutorials.

## Recommended contracts

### A. RobinOwlsNFT

ERC-721 collection contract.

Responsibilities:

- total supply cap: 3,333
- mint phases
- GTD allowlist
- FCFS allowlist/access
- public mint
- per-wallet limits
- reserved/team minting
- provenance/metadata controls
- reveal/base URI controls
- pause emergency control
- withdrawal/treasury routing
- ownership transfer
- optionally royalty metadata if desired and supported by marketplace strategy

Do not include game logic inside the NFT contract.

### B. GameEscrow

Separate contract for optional paid match funds.

Responsibilities:

- create match escrow
- accept player deposits
- lock funds
- verify authorized settlement signature
- prevent replay
- settle according to match configuration
- refund on verified cancellation
- expire/cancel where appropriate
- emit events
- emergency pause

The contract must never trust a frontend claim such as `winner=true`.

### C. ReferralRewards

Optional contract for batched claim distribution.

Preferred approach:

- backend calculates qualified referral rewards
- admin/operator publishes a signed/Merkle reward root for an epoch
- users claim rewards
- contract prevents double claiming

### D. RewardToken (OPTIONAL, DISABLED)

Only implement after tokenomics and compliance are approved.

If implemented:

- capped or controlled minting policy
- role-based access
- pause/emergency controls
- emission schedule
- explicit sinks
- anti-abuse strategy
- treasury separation

Do not deploy a token just because the UI has a `Rewards` tab.

### E. TournamentPrizeVault (OPTIONAL)

Can be used later for prize pools if a clean onchain tournament economy is required.

Do not build it before match and tournament accounting is stable.

---

# 26. Smart Contract Security Baseline

Use current OpenZeppelin Contracts releases and read the current documentation before implementation.

Use appropriate components such as:

- `ERC721`
- `Ownable2Step` or role-based administration
- `AccessControl` or `AccessManager` where system complexity justifies it
- `Pausable`
- `ReentrancyGuard`
- signature verification utilities

OpenZeppelin's current documentation recommends role-based access control for complex systems and notes that `Ownable2Step` reduces ownership-transfer mistakes. Its security utilities include `ReentrancyGuard` and pausable token extensions. citeturn986919search1turn986919search2turn986919search3turn986919search7

### Required rules

- Never commit private keys.
- Use environment variables for test/deployment keys.
- Use a throwaway deployer key for testnet.
- Production admin should use a secure multisig or equivalent operational control.
- Separate deployer, treasury and operational roles.
- Use two-step ownership transfer.
- Pause critical contracts during a confirmed incident.
- Add replay protection to signed settlement messages.
- Include chain ID in signed data.
- Include contract address/domain separator in EIP-712 signatures.
- Include match ID, rules version, result, payout config version and expiry/nonce in settlement messages.
- Never rely on `tx.origin`.
- Protect withdrawals against reentrancy.
- Use pull-based claims where appropriate.
- Validate all external inputs.
- Emit events for important state changes.
- Keep privileged functions narrow and explicit.

---

# 27. NFT Mint Contract Design

Use a phase-based state machine.

Recommended phase structure:

### Team / Reserved

Target allocation: **100**.

### GTD

Target allocation: **500**.

### FCFS

Target allocation: **700**.

### Public

Target allocation: **2,033**.

Total:

**3,333**.

These are the current planned distribution values for Robin Owls and are configuration, not immutable technical requirements.

## Allowlist implementation

Prefer one of:

- Merkle root allowlist
- EIP-712 signed mint vouchers

For GTD/FCFS, the backend should produce eligibility proofs from an approved allowlist source.

Every mint must enforce:

- phase active
- phase cap
- wallet cap
- total supply cap
- correct payment
- correct eligibility
- correct chain

Do not implement allowlist verification only in the frontend.

---

# 28. Metadata and Reveal

Support:

- unrevealed metadata
- final revealed metadata
- base URI management
- optional delayed reveal
- permanent provenance/hash record where desired

Recommended production pattern:

1. Mint uses placeholder/unrevealed metadata.
2. Metadata is pinned/persisted on reliable storage.
3. Final reveal is prepared and hashed.
4. Admin publishes reveal after QA.
5. Base URI changes only through controlled role.
6. UI shows reveal status from the contract/config, not a hardcoded label.

Never let an arbitrary frontend admin button change metadata without role protection.

---

# 29. Wallet and NFT Verification

Use EVM wallet connection compatible with Robinhood Chain.

The official Robinhood Chain documentation states the network supports EVM wallets including MetaMask and provides chain configuration for mainnet and testnet. citeturn708898search3

Frontend responsibilities:

- connect wallet
- switch network
- sign authentication message
- read NFT ownership
- show holder status
- call mint contract
- show transaction state
- link transaction to Blockscout

Backend responsibilities:

- verify wallet signature
- issue session
- associate wallet with user
- cache NFT ownership
- invalidate stale ownership when necessary

Never treat a wallet address typed into an input as proof of ownership.

---

# 30. Game Onchain vs Offchain Boundary

Put onchain:

- NFT ownership
- NFT minting
- optional paid match escrow
- optional prize vault
- optional referral claims
- optional future reward token

Keep offchain:

- realtime chess moves
- ability animations
- timers as displayed to users
- matchmaking
- chat
- ratings
- profile stats
- anti-cheat analysis
- replays
- most cosmetics
- analytics

This separation keeps the game responsive and reduces unnecessary transaction costs.

---

# 31. Admin Dashboard

Build an authenticated admin application with role-based access.

Roles:

### Super Admin

System-wide configuration and emergency actions.

### Game Operator

Match/tournament management.

### Moderator

Player reports and moderation.

### Finance Operator

Economic reports, settlement monitoring and treasury reporting.

### Support

Support tickets and account assistance.

Admin capabilities:

- player search
- match search
- match replay
- cancel/void disputed match according to policy
- inspect event logs
- inspect referral attribution
- inspect suspicious activity
- tournament management
- cosmetic management
- announcement management
- system health
- settlement failures
- queue health
- RPC health
- database health

Every privileged action must create an audit log.

---

# 32. Moderation and Fair Play

Support:

- player report
- match report
- cheating report
- abusive behavior report
- technical issue report

Moderation status model:

`OPEN -> REVIEWING -> ACTIONED -> CLOSED`

Possible actions:

- warning
- temporary matchmaking restriction
- referral reward suspension
- tournament restriction
- temporary account suspension
- permanent suspension

Only strong evidence should trigger severe action.

---

# 33. Observability

Instrument:

- API latency
- WebSocket connection count
- match creation rate
- match completion rate
- reconnect rate
- abandonment rate
- move rejection rate
- ability rejection rate
- matchmaking wait time
- settlement success/failure rate
- RPC error rate
- database errors
- Redis errors
- queue depth
- active players
- daily active players
- weekly active players
- NFT-holder active players
- referred active players

Alerts:

- settlement failure spike
- RPC outage
- database unavailable
- WebSocket failure spike
- abnormal disconnect spike
- unusual reward issuance
- unusual referral activity
- contract pause

Never expose raw secrets in logs.

---

# 34. Analytics

Track the product funnel:

### Acquisition

- landing visits
- wallet connect
- registrations
- referral signups
- qualified users

### Activation

- first match
- first completed match
- first Robin Mode match
- first tournament entry

### Retention

- day 1
- day 7
- day 30

### NFT utility

- holder game participation
- holder tournament participation
- avatar usage
- cosmetic usage
- referrals per holder

### Economy

- total entry volume
- platform fees
- prize volume
- refunds/cancellations
- referral rewards
- treasury movements

Do not use floor price or token price as the game's primary product-health metric.

---

# 35. UI Sitemap

Build these screens:

## Public

- Landing
- About
- How to Play
- Game Modes
- Robin Mode Abilities
- Leaderboard
- Tournaments
- FAQ
- Connect Wallet

## Authenticated

- Home
- Matchmaking
- In-Game
- Ability Selection
- Match Result
- Match History
- Replay
- Profile
- Achievements
- Cosmetics
- Referrals
- Tournament Hub
- Settings

## Admin

- Dashboard
- Players
- Matches
- Reports
- Tournaments
- Referrals
- Economy
- Contracts
- System Health
- Audit Log

---

# 36. Home Screen

Primary CTA:

**PLAY NOW**

Secondary choices:

- Classic Chess
- Robin Mode
- Tournaments

Supporting cards:

- Your rating
- Recent match
- Active tournament
- NFT holder status
- Referral progress

Keep the first screen focused. Do not turn it into a dashboard overload.

---

# 37. Matchmaking UI

Show:

- selected mode
- time control
- entry requirement
- ability asymmetry if enabled
- expected wait
- opponent when found
- cancel action

Before a paid match begins:

**Show the exact fee, payout rules, cancellation rules and whether abilities are asymmetric.**

Require explicit confirmation.

---

# 38. In-Game UI

Top:

- opponent avatar
- rating
- clock
- connection state

Center:

- chessboard
- legal move highlights
- last move highlight
- check indicator
- frozen piece indicator
- ability indicator

Bottom:

- ability controls
- move history
- resign
- draw
- connection status

Do not show distracting decorative animation during tactical moments.

---

# 39. Match Result UI

Show:

- result
- checkmate/resignation/timeout/abandonment
- players
- rating change
- match duration
- move count
- mode
- rewards/economic outcome when applicable
- replay
- rematch
- return home

The existing concept used `VICTORY`, `Checkmate`, player ratings, game mode, duration, moves, rating change, Play Again and Back to Home. fileciteturn3file6

---

# 40. Tournament System

MVP tournament formats:

- single elimination
- round robin for small private events

Tournament config:

- mode
- rulesVersion
- max participants
- entry type
- time control
- registration window
- bracket size
- prize configuration
- eligibility

For holder-only tournaments:

- verify NFT ownership at registration
- decide snapshot policy before launch
- prevent ambiguity if the NFT transfers after registration

Recommended policy:

`Eligibility is checked at registration and is not retroactively changed unless the tournament rules explicitly state otherwise.`

---

# 41. Game Rules Versioning

Every match must record a `rulesVersion`.

Example:

`ROBIN_1_0`

This matters because abilities may be balanced later.

Never change ability behavior retroactively inside an active match.

Rules updates apply to new matches only.

---

# 42. Security Testing Matrix

## NFT contract

Test:

- total supply cap
- phase caps
- wallet caps
- allowlist proofs
- wrong proof
- expired proof
- wrong chain
- overpayment
- underpayment
- pause
- unpause authorization
- ownership transfer
- withdrawal authorization
- metadata update authorization
- reentrancy-sensitive functions
- reserve minting
- reveal

## Game escrow

Test:

- deposit by player A
- deposit by player B
- duplicate deposit
- match ID replay
- unauthorized settlement
- expired settlement
- invalid signature
- wrong chain ID in signature
- wrong contract in signature domain
- wrong winner
- double settlement
- cancellation
- system failure refund
- partial funding
- withdrawal authorization
- pause
- reentrancy

## Referral claims

Test:

- claim once
- claim twice
- wrong epoch
- wrong proof
- modified reward amount
- wrong recipient
- revoked reward
- pause

---

# 43. Smart Contract Deployment Workflow

Follow this sequence:

1. Write contracts.
2. Write unit tests.
3. Write fuzz/invariant tests where useful.
4. Compile with pinned versions.
5. Deploy locally.
6. Test integration locally.
7. Deploy to Robinhood Chain Testnet.
8. Verify contracts on the testnet Blockscout explorer.
9. Run frontend against testnet.
10. Run end-to-end tests.
11. Run security review.
12. Freeze release candidate.
13. Deploy mainnet only after explicit approval.
14. Verify mainnet contracts.
15. Record final addresses in a single versioned config.

Robinhood's official deployment guide explicitly recommends testnet first and gives Blockscout verification instructions. citeturn708898search1

---

# 44. Environment Variables

Use environment variables, never hardcode secrets.

Example:

```env
NEXT_PUBLIC_CHAIN_ID=46630
NEXT_PUBLIC_RPC_URL=...
NEXT_PUBLIC_EXPLORER_URL=...
NEXT_PUBLIC_NFT_CONTRACT=...
NEXT_PUBLIC_ESCROW_CONTRACT=...

DATABASE_URL=...
REDIS_URL=...
JWT_SECRET=...
SESSION_SECRET=...
GAME_OPERATOR_PRIVATE_KEY=...
DEPLOYER_PRIVATE_KEY=...
ALCHEMY_API_KEY=...
```

Production must use the production chain ID and secure provider endpoints.

Never commit `.env` files containing secrets.

---

# 45. Recommended Repository Structure

Use a monorepo if the project is being built from scratch:

```text
owlsgambit/
├─ apps/
│  ├─ web/
│  ├─ admin/
│  └─ api/
├─ packages/
│  ├─ chess-engine/
│  ├─ shared-types/
│  ├─ ui/
│  ├─ wallet/
│  ├─ contracts-sdk/
│  └─ config/
├─ contracts/
│  ├─ src/
│  ├─ test/
│  ├─ script/
│  └─ deployments/
├─ infra/
│  ├─ docker/
│  └─ monitoring/
├─ docs/
│  ├─ architecture.md
│  ├─ game-rules.md
│  ├─ economics.md
│  ├─ security.md
│  └─ deployment.md
├─ scripts/
├─ .github/
│  └─ workflows/
├─ package.json
└─ README.md
```

Keep shared game rules and types in one package so frontend and backend do not drift.

---

# 46. CI/CD

Every pull request must run:

- typecheck
- lint
- unit tests
- chess rules tests
- Robin Mode ability tests
- API tests
- contract tests
- build

Protected main branch:

- required checks
- no force-push for ordinary contributors
- deployment only after green build

Testnet deployment can happen from approved branches.

Mainnet deployment must require an explicit manual approval step.

---

# 47. Acceptance Criteria for Robin Mode

A feature is complete only when:

### Second Chance

- cannot be used after opponent response
- cannot be used after match finalization
- cannot be used twice
- rollback exactly restores prior canonical state
- replacement move is legal
- replay displays the event
- both clients end with identical state

### Freeze

- King cannot be targeted
- selected piece cannot move/capture during freeze
- freeze expires exactly on schedule
- frozen status persists through reconnect
- cannot be used twice
- replay displays activation/expiration

### Tactical Swap

- two own eligible pieces only
- King cannot be selected
- ability consumes the turn
- resulting position is validated
- own King cannot be left in check
- state is deterministic on reconnect
- replay works

---

# 48. Acceptance Criteria for Disconnects

Test all scenarios:

1. player closes browser
2. player disables Wi-Fi
3. player loses ISP connection
4. player laptop sleeps
5. player reconnects quickly
6. player reconnects after timeout
7. game server loses one socket
8. game server loses database connectivity
9. Redis outage
10. RPC outage
11. both players disconnect because of a server incident

Expected policy:

- player-side disconnect -> reconnect window
- reconnect -> continue
- failure to reconnect -> abandonment/loss according to rules
- verified platform-wide failure -> cancellation/refund according to rules

Never grant an automatic refund based solely on a client disconnect event.

---

# 49. Acceptance Criteria for Referral

Test:

- valid referral link
- same user referring themselves
- wallet cycling
- multiple wallets
- duplicate account
- referred user qualifying
- referred user failing qualification
- refund abuse
- bot matches
- reward cap
- reward epoch
- claim
- double claim

The system must be possible to audit after the fact.

---

# 50. Economic Safety Rules

The platform must maintain a ledger for every economic event.

Every balance-affecting event needs:

- event ID
- user
- match/tournament/referral source
- currency
- amount
- direction
- status
- timestamp
- blockchain tx hash if applicable
- settlement version

Never calculate a user's economic balance only from the frontend state.

Prefer a double-entry-like internal ledger for platform accounting.

---

# 51. Future Token Architecture

Do not make the reward token required for the MVP.

When/if approved, design:

### Utility

- tournament rewards
- cosmetics
- special events
- controlled progression
- optional ecosystem rewards

### Sinks

- cosmetic purchases
- tournament entry where appropriate
- crafting/upgrade mechanics if actually useful
- seasonal activities

### Safety

- explicit emission cap or controlled issuance schedule
- admin role controls
- pause mechanism
- monitoring
- anti-bot distribution
- treasury accounting

Never build the economy around the assumption that users will buy the token from secondary markets forever.

---

# 52. Product Roadmap

## Milestone 1 - Foundation

- repo setup
- design system
- wallet auth
- database
- core web shell
- Classic Chess
- profiles
- match history

## Milestone 2 - Realtime

- matchmaking
- WebSocket gameplay
- authoritative clocks
- reconnect system
- replay events

## Milestone 3 - Robin Mode

- ability selection
- Second Chance
- Freeze
- Tactical Swap
- rulesVersion
- ability replay

## Milestone 4 - NFT Utility

- NFT ownership verification
- NFT avatar
- holder status
- holder cosmetics
- holder tournament access
- referrals

## Milestone 5 - Economy Sandbox

- play-money match ledger
- configurable fee engine
- referral accounting
- tournament prize accounting

## Milestone 6 - Smart Contracts

- NFT mint contract
- escrow contract
- claim contract if needed
- testnet deployment
- verification

## Milestone 7 - Paid Match Candidate

Only after legal/compliance review:

- real entry fees
- settlement
- refunds for verified system failures
- finance dashboard

## Milestone 8 - Production Hardening

- security review
- load testing
- anti-cheat review
- incident playbooks
- monitoring
- backups
- disaster recovery
- final UX polish

---

# 53. Antigravity Operating Protocol

When Antigravity starts work on this project, follow this exact loop.

## Step A - Inspect before changing

First inspect:

- repository structure
- existing package manager
- existing framework
- existing contracts
- environment files/templates
- current UI
- current database schema
- current deployment setup

Do not overwrite an existing project blindly.

## Step B - Produce a technical gap report

Before a major build, identify:

- what already exists
- what is missing
- what is unsafe
- what is reusable
- what must be refactored

Do not claim something works until you have run it.

## Step C - Build one vertical slice

Example:

`Wallet -> Matchmaking -> Classic Match -> Result`

Make that fully work first.

## Step D - Add Robin Mode

Implement one ability at a time.

For each:

- backend rule
- shared type
- frontend control
- server test
- integration test
- replay test

## Step E - Add NFT utility

Verify actual contract ownership rather than mock data.

## Step F - Add economics

Start with play-money/sandbox accounting.

Only later connect real funds.

## Step G - Add contracts

Test locally and testnet before mainnet.

## Step H - Security pass

Review authorization, settlement, signatures, replay, withdrawals, referrals and admin roles.

## Step I - Production pass

Load test, reconnect test, browser test, mobile test, accessibility test.

## Step J - Document

Every completed milestone must update:

- README
- architecture docs
- environment docs
- rules version
- deployment notes
- contract addresses when known

---

# 54. Antigravity Rules: Do Not Cheat the Build

Never:

- fabricate contract addresses
- fabricate a deployed transaction
- claim testnet/mainnet deployment without actually deploying
- claim a security audit was completed without an actual audit
- claim a server is production ready without load/reconnect testing
- claim a feature is onchain when it is only UI
- hide errors by swallowing exceptions
- hardcode secrets
- trust client game state
- trust client timers
- settle funds from frontend values
- let NFTs directly modify Classic Chess
- silently change game rules
- ship broken TypeScript with `any` everywhere
- use fake placeholder data in production-critical paths
- make a mock screenshot look like a real shipped game screenshot

When an external dependency is unavailable, implement an honest adapter/stub and label it clearly.

---

# 55. Antigravity Build Order: Exact Priority

Build in this order unless the owner explicitly changes it:

1. Architecture and repo inspection.
2. Shared types/config.
3. Database and authentication.
4. Classic Chess engine wrapper.
5. Authoritative match service.
6. WebSocket gameplay.
7. Clock/reconnect/abandonment system.
8. Matchmaking.
9. Profiles/ratings/history.
10. Robin Mode state machine.
11. Second Chance.
12. Freeze.
13. Tactical Swap.
14. Replay.
15. NFT ownership and wallet integration.
16. NFT avatars and cosmetics.
17. Referral system.
18. Tournament system.
19. Admin dashboard.
20. Play-money economy.
21. Smart-contract test suite.
22. NFT mint contract.
23. Escrow contract, only if paid matches are approved.
24. Testnet deployment and verification.
25. E2E testing.
26. Load/security testing.
27. Mainnet deployment approval gate.

Do not start with tokenomics.

Do not start with the paid escrow contract.

Do not start with visual polish before the match engine is reliable.

---

# 56. Definition of Done

The game is not production-ready until all of these are true:

### Gameplay

- Classic Chess works.
- Robin Mode works.
- All three abilities work exactly as specified.
- Server is authoritative.
- Reconnect works.
- Abandonment works.
- Replays reproduce games.

### Account

- Wallet auth works.
- NFT holder verification works.
- Profile works.
- Ratings work.
- Match history works.

### NFT utility

- NFT avatar works.
- Holder-only configuration works.
- Holder tournaments work.
- Cosmetics work.

### Referrals

- link creation works
- attribution works
- qualification works
- anti-abuse controls exist
- reward ledger exists
- claim flow works if onchain claims are enabled

### Admin

- player lookup
- match lookup
- reports
- tournaments
- audit logs
- health dashboard

### Contracts

- compile
- tests
- testnet deployment
- explorer verification
- frontend integration
- emergency controls

### Security

- no secrets committed
- roles protected
- replay protection
- reentrancy protection
- pause controls
- signed settlement protection
- rate limiting
- audit trail

### Operations

- monitoring
- alerts
- database backups
- deployment docs
- incident runbook
- rollback strategy

---

# 57. UX Quality Bar

The game should feel closer to a polished indie competitive game than a crypto dashboard.

Priorities:

1. gameplay clarity
2. responsiveness
3. readable board
4. trustworthy wallet/payment flows
5. smooth transitions
6. consistent Robin Owls art direction
7. restrained Web3 language

Avoid:

- endless glowing borders
- excessive neon
- giant crypto price widgets
- cluttered dashboards
- forced wallet prompts
- unnecessary blockchain jargon
- animations that interfere with gameplay

---

# 58. Mobile Requirements

The game must work on phone widths.

At minimum:

- board remains readable
- clocks remain visible
- ability buttons remain reachable
- action controls do not overlap
- reconnect modal is usable
- wallet flow works
- profile works
- match result works

Use touch-friendly targets.

Never rely on hover for gameplay information.

---

# 59. Accessibility

Include:

- keyboard navigation
- focus states
- high contrast
- meaningful aria labels
- non-color indicators for check/freeze/status
- reduced-motion support
- readable typography
- screen-reader labels for buttons and game events where practical

Chessboard squares must not communicate state through color alone.

---

# 60. Recommended Initial Configuration

Keep these values centralized.

```ts
export const gameConfig = {
  collection: {
    name: 'Robin Owls',
    supply: 3333,
  },
  robinMode: {
    abilityPool: [
      'SECOND_CHANCE',
      'PIECE_FREEZE',
      'TACTICAL_SWAP',
    ],
    holderSelectionCount: 2,
    nonHolderSelectionCount: 1,
    secondChanceUses: 1,
    freezeUses: 1,
    freezeDurationOpponentTurns: 1,
    tacticalSwapUses: 1,
    tacticalSwapConsumesTurn: true,
    reconnectWindowSeconds: 45,
  },
  referrals: {
    platformFeeSharePercent: 20,
    qualificationMatches: 3,
    maxRewardPerDay: null,
  },
  mint: {
    teamReserved: 100,
    gtd: 500,
    fcfs: 700,
    public: 2033,
    prices: {
      gtdWei: null,
      fcfsWei: null,
      publicWei: null,
    },
  },
  economy: {
    playMoneyMode: true,
    realValueSettlementEnabled: false,
    rewardTokenEnabled: false,
  },
};
```

Do not hardcode final mint prices or payout percentages until the owner explicitly approves them.

---

# 61. Testing Scenarios That Must Exist

## Chess

- legal move
- illegal move
- check
- checkmate
- stalemate
- draw
- resignation
- timeout

## Second Chance

- immediate rollback
- rollback after opponent response rejected
- second use rejected
- reconnect during ability window
- match finalization during ability window

## Freeze

- valid target
- King rejected
- freeze persists through reconnect
- freeze expires
- repeated use rejected

## Tactical Swap

- valid swap
- King rejected
- leaving own King in check rejected
- swap consumes turn
- replay deterministic
- castling state deterministic
- en-passant state deterministic

## Network

- reconnect success
- reconnect timeout
- browser crash
- Wi-Fi interruption
- server restart
- Redis unavailable
- DB unavailable

## NFT

- holder detected
- non-holder detected
- transferred NFT
- multiple NFTs
- multiple wallets
- stale cache

## Referrals

- valid qualification
- self-referral
- sybil attempt
- reward cap
- claim replay

## Economy

- correct fee
- correct settlement
- double settlement blocked
- refund/cancellation
- signed result tampering rejected

---

# 62. Signed Settlement Message

For any onchain settlement controlled by the game backend, use a typed EIP-712 structure conceptually similar to:

```text
Settlement(
  matchId,
  rulesVersion,
  winner,
  loser,
  stakeAmount,
  payoutAmount,
  feeAmount,
  referralAmount,
  chainId,
  escrowContract,
  nonce,
  deadline
)
```

The exact Solidity struct and hash implementation must be generated and tested from one shared specification.

Validation requirements:

- authorized settlement signer
- correct chain
- correct escrow contract
- unexpired message
- unused nonce/match ID
- correct participants
- correct amounts
- correct settlement version

Never sign raw JSON strings without a canonical typed-data format.

---

# 63. Contract Role Model

Suggested roles:

- `DEFAULT_ADMIN_ROLE`
- `PAUSER_ROLE`
- `MINTER_ROLE`
- `GAME_OPERATOR_ROLE`
- `SETTLEMENT_ROLE`
- `TREASURY_ROLE`
- `METADATA_ROLE`

Prefer minimal authority per role.

For production, consider using OpenZeppelin `AccessManager` for a multi-contract system where centralized permission management and delays are useful. citeturn986919search1turn986919search2

---

# 64. Treasury Safety

Do not let one hot wallet have unrestricted power.

Separate:

- NFT mint treasury
- game operations wallet
- contract admin
- deployment wallet
- emergency guardian

Document who can do what.

For sensitive changes, prefer multisig and delayed operations where practical.

---

# 65. Documentation to Generate Automatically

Antigravity should maintain:

- `README.md`
- `docs/architecture.md`
- `docs/game-rules.md`
- `docs/robin-mode.md`
- `docs/referrals.md`
- `docs/economy.md`
- `docs/security.md`
- `docs/contracts.md`
- `docs/deployment.md`
- `docs/incident-response.md`
- `docs/api.md`
- `docs/replay-format.md`

Generate API documentation from code where possible.

---

# 66. Build Report Format

After each major milestone, Antigravity must report:

```text
MILESTONE:

Implemented:
- ...

Files changed:
- ...

Tests run:
- ...

Tests passed:
- ...

Known issues:
- ...

Security concerns:
- ...

Next milestone:
- ...
```

Never write “Done” when only the UI is complete.

---

# 67. Final Product Principle

The product should answer four questions immediately:

### What is it?

A competitive PvP chess game inside the Robin Owls universe.

### Why Robin Owls?

The NFT becomes the player's identity and gateway into the game's wider ecosystem.

### What makes it different?

Robin Mode introduces carefully constrained tactical abilities on top of chess, alongside holder tournaments, cosmetics and referral-based access.

### Why should players return?

Because matches are skill-driven, progression is persistent, competition continues through ratings and tournaments, and the Robin Owls universe gives players an identity beyond a single chess match.

---

# 68. Non-Negotiable Engineering Philosophy

Build the game as a **real game first**.

Build Web3 around it where Web3 adds a genuine function.

Use blockchain for ownership and settlement where it makes sense.

Do not put every interaction onchain.

Do not make the game dependent on speculative token price.

Do not let NFT ownership break the credibility of the competitive experience.

Do not compromise security for a faster demo.

Do not call a prototype a finished product.

Do not call unreviewed smart contracts safe.

Do not call a system decentralized when a centralized operator controls an important part of it.

When there is a conflict between visual polish and game correctness, choose game correctness.

When there is a conflict between rapid shipping and smart-contract safety, choose safety.

When there is a conflict between adding another feature and making existing mechanics reliable, make existing mechanics reliable first.

---

# 69. Current External References

Use official/current documentation when implementing chain and contract infrastructure:

Robinhood Chain overview:
https://docs.robinhood.com/chain/

Connecting to Robinhood Chain:
https://docs.robinhood.com/chain/connecting/

Deploying a smart contract:
https://docs.robinhood.com/chain/deploy-smart-contracts/

Add Robinhood Chain to wallet:
https://docs.robinhood.com/chain/add-network-to-wallet/

OpenZeppelin Contracts:
https://docs.openzeppelin.com/contracts/5.x/

OpenZeppelin Access Control:
https://docs.openzeppelin.com/contracts/5.x/access-control

OpenZeppelin ReentrancyGuard:
https://docs.openzeppelin.com/contracts/5.x/api/utils

OpenZeppelin ERC-721:
https://docs.openzeppelin.com/contracts/5.x/api/token/erc721

These links are references, not permission to assume a library/API version remains unchanged. Re-check official documentation during implementation.

---

# 70. Start Here

When first invoked in an existing repository, do NOT immediately generate thousands of lines of code.

First:

1. Inspect the repo.
2. Detect the current stack.
3. Locate existing website/game assets and the Robin Owls UI references.
4. Produce a concise architecture/gap report.
5. Create the shared configuration and type packages.
6. Build the smallest end-to-end playable Classic Chess vertical slice.
7. Run it.
8. Test it.
9. Commit it.
10. Then proceed milestone by milestone.

The first real acceptance test is simple:

**Two users can connect, get matched, play a legal chess game in realtime, disconnect and reconnect, finish the match, receive a deterministic result, and view the replay.**

Only after that works should Robin Mode powers, NFT utilities, referrals, tournaments, paid settlement and additional smart-contract functionality be layered on top.

---

# 71. Historical Reference: What the Original Lightpaper Contained

The original document described:

- paid PvP chess modes
- entry fees
- a winner payout model
- in-game token rewards
- NFT-gated game access with referral invitations
- NFT-only tournaments
- NFT avatars
- VIP support
- exclusive board/customization items
- referral rewards
- token airdrops
- fair-play refund
- three gameplay abilities: Undo Move, Piece Freeze and Tactical Swap

These were the foundation of the concept. fileciteturn3file0L15-L55

The current skill keeps the useful product ideas but replaces ambiguous or abuse-prone mechanics with deterministic, testable rules.

---

# 72. Final Instruction to Antigravity

Treat this skill as the **single engineering brief for Owl's Gambit**.

Your output is not merely code.

Your output is:

**a playable game + secure backend + tested game engine + NFT integration + referral system + admin system + production infrastructure + smart-contract suite + tests + deployment scripts + documentation.**

Build it incrementally.

Verify every claim.

Keep game rules deterministic.

Keep economic rules configurable.

Keep real-money features disabled until explicitly approved.

Test on Robinhood Chain Testnet before Mainnet.

Use official current chain documentation at implementation time.

Never fabricate production readiness.

End every milestone with working software and evidence that it works.
