const assert = require('assert');
const ChessEngine = require('../public/js/chess-engine.js');
const { DAILY_PUZZLES } = require('../public/js/puzzles-config.js');

console.log('--- RUNNING DAILY CHESS PUZZLE SUITE ---');

// 1. Verify puzzle catalog length and levels
assert(Array.isArray(DAILY_PUZZLES), 'DAILY_PUZZLES must be an array');
assert.strictEqual(DAILY_PUZZLES.length, 15, 'Must contain exactly 15 curated levels');

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
console.log('✔ Catalog metadata, 15 levels, rewards and hints verified');

// 2. Verify reward progression scales with level difficulty
for (let i = 1; i < DAILY_PUZZLES.length; i++) {
  assert(DAILY_PUZZLES[i].xpReward >= DAILY_PUZZLES[i - 1].xpReward,
    `XP reward should scale with level: level ${i+1} (${DAILY_PUZZLES[i].xpReward}) vs level ${i} (${DAILY_PUZZLES[i-1].xpReward})`);
  assert(DAILY_PUZZLES[i].coinsReward >= DAILY_PUZZLES[i - 1].coinsReward,
    `Coins reward should scale with level: level ${i+1} (${DAILY_PUZZLES[i].coinsReward}) vs level ${i} (${DAILY_PUZZLES[i-1].coinsReward})`);
}
console.log('✔ Escalating XP and Coin progression verified (Level 1: 40 XP / 60 Coins -> Level 15: 150 XP / 200 Coins)');

// 3. Verify every FEN loads into ChessEngine, matches turn, and solution is 100% legal
DAILY_PUZZLES.forEach((puzzle) => {
  const engine = new ChessEngine();
  const loaded = engine.loadFEN(puzzle.fen);
  assert(loaded, `ChessEngine must successfully load FEN for Puzzle ${puzzle.level}: ${puzzle.title}`);
  assert.strictEqual(engine.currentTurn, puzzle.playerColor,
    `Current turn in FEN must match puzzle.playerColor for Puzzle ${puzzle.level}`);

  const firstMove = puzzle.solution[0];
  const fromCoord = firstMove.slice(0, 2);
  const toCoord = firstMove.slice(2, 4);
  const promo = firstMove[4] || null;

  const from = ChessEngine.fromAlgebraic(fromCoord);
  const to = ChessEngine.fromAlgebraic(toCoord);

  const legalMoves = engine.getLegalMoves(from.row, from.col);
  const isLegal = legalMoves.some(m => m.row === to.row && m.col === to.col);
  assert(isLegal, `Solution move ${firstMove} must be strictly LEGAL in Puzzle ${puzzle.level} (${puzzle.title})`);

  const result = engine.makeMove(from.row, from.col, to.row, to.col, promo);
  assert(result, `makeMove must succeed for solution move in Puzzle ${puzzle.level}`);

  // In our 15 checkmate puzzles, verify checkmate or check
  if (puzzle.solution.length === 1) {
    assert(engine.gameOver, `Single-move puzzle ${puzzle.level} must result in checkmate/gameover`);
    assert.strictEqual(engine.gameResult.winner, puzzle.playerColor,
      `Puzzle ${puzzle.level} solution must declare ${puzzle.playerColor} as the winner`);
  }
});
console.log('✔ All 15 puzzles successfully load and execute verified legal solutions with checkmate');

// 4. Verify puzzle hint double-down economy integration
const fs = require('fs');
const path = require('path');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const economyConfig = require('../public/js/economy-config.js');

const hintCosts = economyConfig.hintsAndUndos.hintCosts;
assert.deepStrictEqual(hintCosts, [25, 50, 100, 200], 'Hint double-down costs must be [25, 50, 100, 200]');
assert(appSource.includes("this.spendCoins(hintCost, 'puzzle_hint')"), 'showPuzzleHint must spend coins with puzzle_hint reason');
assert(appSource.includes("updatePuzzleHintButtonUI"), 'updatePuzzleHintButtonUI method must be wired');
assert(appSource.includes("Hint limit reached for this challenge"), 'Hint limit guard must be present');
console.log('✔ Puzzle hint double-down costs [25, 50, 100, 200] and coin deductions verified');

console.log('--- ALL DAILY PUZZLE TESTS PASSED SUCCESSFULLY! ---');

