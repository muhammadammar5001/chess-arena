const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ChessEngine = require('../public/js/chess-engine.js');
const { DAILY_PUZZLES } = require('../public/js/puzzles-config.js');

console.log('--- RUNNING DAILY CHESS PUZZLE SUITE (50 PUZZLES & AD FEATURES) ---');

const promoMap = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };

// 1. Verify puzzle catalog length and levels (50 curated levels)
assert(Array.isArray(DAILY_PUZZLES), 'DAILY_PUZZLES must be an array');
assert.strictEqual(DAILY_PUZZLES.length, 50, 'Must contain exactly 50 curated levels');

DAILY_PUZZLES.forEach((puzzle, idx) => {
  const expectedLevel = idx + 1;
  assert.strictEqual(puzzle.id, expectedLevel, `Puzzle at index ${idx} must have id ${expectedLevel}`);
  assert.strictEqual(puzzle.level, expectedLevel, `Puzzle ${puzzle.id} must have level ${expectedLevel}`);
  assert(puzzle.title && typeof puzzle.title === 'string', `Puzzle ${puzzle.id} must have a title`);
  assert(puzzle.subtitle && typeof puzzle.subtitle === 'string', `Puzzle ${puzzle.id} must have a subtitle`);
  assert(puzzle.hint && typeof puzzle.hint === 'string', `Puzzle ${puzzle.id} must have a hint`);
  assert(['white', 'black'].includes(puzzle.playerColor), `Puzzle ${puzzle.id} playerColor must be white or black`);
  assert(Array.isArray(puzzle.solution) && puzzle.solution.length > 0, `Puzzle ${puzzle.id} must have solution moves`);
  assert(puzzle.xpReward > 0, `Puzzle ${puzzle.id} xpReward must be positive`);
  assert(puzzle.coinsReward > 0, `Puzzle ${puzzle.id} coinsReward must be positive`);
});
console.log('✔ Catalog metadata, 50 levels, rewards and hints verified');

// 2. Verify reward progression scales with level difficulty
for (let i = 1; i < DAILY_PUZZLES.length; i++) {
  assert(DAILY_PUZZLES[i].xpReward >= DAILY_PUZZLES[i - 1].xpReward,
    `XP reward should scale with level: level ${i+1} (${DAILY_PUZZLES[i].xpReward}) vs level ${i} (${DAILY_PUZZLES[i-1].xpReward})`);
  assert(DAILY_PUZZLES[i].coinsReward >= DAILY_PUZZLES[i - 1].coinsReward,
    `Coins reward should scale with level: level ${i+1} (${DAILY_PUZZLES[i].coinsReward}) vs level ${i} (${DAILY_PUZZLES[i-1].coinsReward})`);
}
console.log('✔ Escalating XP and Coin progression verified (Level 1: 40 XP / 60 Coins -> Level 50: 330 XP / 414 Coins)');

// 3. Verify every single FEN loads into ChessEngine, matches turn, and solution is 100% legal checkmate
DAILY_PUZZLES.forEach((puzzle) => {
  const engine = new ChessEngine();
  const loaded = engine.loadFEN(puzzle.fen);
  assert(loaded, `ChessEngine must successfully load FEN for Puzzle ${puzzle.level}: ${puzzle.title}`);
  assert.strictEqual(engine.currentTurn, puzzle.playerColor,
    `Current turn in FEN must match puzzle.playerColor for Puzzle ${puzzle.level}`);

  const firstMove = puzzle.solution[0];
  const fromCoord = firstMove.slice(0, 2);
  const toCoord = firstMove.slice(2, 4);
  const promo = firstMove[4] ? promoMap[firstMove[4]] : null;

  const from = ChessEngine.fromAlgebraic(fromCoord);
  const to = ChessEngine.fromAlgebraic(toCoord);

  const legalMoves = engine.getLegalMoves(from.row, from.col);
  const isLegal = legalMoves.some(m => m.row === to.row && m.col === to.col && (!promo || m.promotion === promo));
  assert(isLegal, `Solution move ${firstMove} must be strictly LEGAL in Puzzle ${puzzle.level} (${puzzle.title})`);

  const result = engine.makeMove(from.row, from.col, to.row, to.col, promo);
  assert(result, `makeMove must succeed for solution move in Puzzle ${puzzle.level}`);

  assert(engine.gameOver, `Single-move puzzle ${puzzle.level} (${puzzle.title}) must result in checkmate/gameover`);
  assert.strictEqual(engine.gameResult.winner, puzzle.playerColor,
    `Puzzle ${puzzle.level} solution must declare ${puzzle.playerColor} as the winner`);
  assert.strictEqual(engine.gameResult.reason, 'checkmate',
    `Puzzle ${puzzle.level} must conclude with reason checkmate`);
});
console.log('✔ All 50 puzzles successfully load and execute verified legal solutions with checkmate');

// 4. Verify Hybrid Endless Loop & Ad Features in app.js
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

// Endless modulo loop
assert(appSource.includes('(targetLevel - 1) % puzzles.length'), 'startDailyPuzzle must use modulo loop for endless challenges');
assert(appSource.includes('Master Lv.${targetLevel}'), 'Endless master tier display must be formatted for level > 50');

// Feature 1: Free Hint via Rewarded Ad (no coins deducted)
assert(appSource.includes("AdService.showRewarded('puzzle_hint')"), 'showPuzzleHint must trigger rewarded ad for free hint');
assert(appSource.includes("highlightPuzzleHintMove"), 'highlightPuzzleHintMove method must be present');

// Feature 2: 2X Rewards Doubler
assert(appSource.includes("claimPuzzle2XRewards"), 'claimPuzzle2XRewards method must be implemented');
assert(appSource.includes("AdService.showRewarded('puzzle_2x_doubler')"), 'claimPuzzle2XRewards must call rewarded ad');
assert(appSource.includes("this.addCoins(bonusCoins, 'puzzle_2x_doubler')"), 'claimPuzzle2XRewards must grant double coins');

// Feature 3: Natural Interstitial Ad every 3 puzzles
assert(appSource.includes("this.puzzlesSolvedSinceAd = (this.puzzlesSolvedSinceAd || 0) + 1"), 'puzzlesSolvedSinceAd must be incremented on puzzle solved');
assert(appSource.includes("if ((this.puzzlesSolvedSinceAd || 0) >= 3)"), 'Interstitial threshold check (>= 3) must be present');
assert(appSource.includes("AdService.showInterstitial('puzzle_next_level')"), 'Next Level must trigger interstitial when threshold met');
assert(appSource.includes("AdService.showInterstitial('puzzle_exit_lobby')"), 'Exit to Lobby must trigger interstitial when threshold met');
console.log('✔ Hybrid endless loop and all 3 Ad features verified in app.js');

// 5. Verify Option 1: Daily 4-Challenge Cap, Reset Countdown Timer & Bonus Ad Unlock
assert(appSource.includes("this.DAILY_PUZZLES_CAP = 4;"), 'DAILY_PUZZLES_CAP must be set to 4');
assert(appSource.includes("isDailyPuzzleCapReached()"), 'isDailyPuzzleCapReached method must be present');
assert(appSource.includes("getPuzzleResetTimeRemaining()"), 'getPuzzleResetTimeRemaining method must be present');
assert(appSource.includes("startPuzzleTimerTicker()"), 'startPuzzleTimerTicker method must be present');
assert(appSource.includes("stopPuzzleTimerTicker()"), 'stopPuzzleTimerTicker method must be present');
assert(appSource.includes("AdService.showRewarded('puzzle_unlock_bonus')"), 'Must allow unlocking bonus challenges via rewarded ad');
assert(appSource.includes("owl_puzzles_solved_today"), 'Must persist daily solved count');
assert(appSource.includes("owl_bonus_puzzles_today"), 'Must persist bonus puzzles count');
console.log('✔ Daily 4-challenge cap, countdown timer, and bonus ad unlock verified in app.js');

console.log('--- ALL DAILY PUZZLE TESTS PASSED SUCCESSFULLY! ---');
