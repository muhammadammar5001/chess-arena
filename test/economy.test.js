const assert = require('assert');
const fs = require('fs');
const path = require('path');

const config = require('../public/js/economy-config.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test('new players start with 1,000 coins', () => {
  assert.strictEqual(config.currency.startingCoins, 1000);
});

test('AI match rewards match the advertised table', () => {
  assert.deepStrictEqual(config.calculateMatchReward('ai', 'easy', 'win'), { coins: 30, xp: 20 });
  assert.deepStrictEqual(config.calculateMatchReward('ai', 'easy', 'draw'), { coins: 15, xp: 12 });
  assert.deepStrictEqual(config.calculateMatchReward('ai', 'easy', 'loss'), { coins: 10, xp: 8 });

  assert.deepStrictEqual(config.calculateMatchReward('ai', 'medium', 'win'), { coins: 50, xp: 35 });
  assert.deepStrictEqual(config.calculateMatchReward('ai', 'medium', 'draw'), { coins: 25, xp: 20 });
  assert.deepStrictEqual(config.calculateMatchReward('ai', 'medium', 'loss'), { coins: 10, xp: 12 });

  assert.deepStrictEqual(config.calculateMatchReward('ai', 'hard', 'win'), { coins: 80, xp: 60 });
  assert.deepStrictEqual(config.calculateMatchReward('ai', 'hard', 'draw'), { coins: 40, xp: 35 });
  assert.deepStrictEqual(config.calculateMatchReward('ai', 'hard', 'loss'), { coins: 10, xp: 20 });
});

test('PvP match rewards match the advertised table', () => {
  assert.deepStrictEqual(config.calculateMatchReward('online', 'easy', 'win'), { coins: 90, xp: 50 });
  assert.deepStrictEqual(config.calculateMatchReward('online', 'easy', 'draw'), { coins: 50, xp: 25 });
  assert.deepStrictEqual(config.calculateMatchReward('online', 'easy', 'loss'), { coins: 25, xp: 20 });
});

test('unknown difficulty safely falls back to medium', () => {
  assert.deepStrictEqual(config.calculateMatchReward('ai', 'impossible', 'win'), { coins: 50, xp: 35 });
});

test('first win of the day bonus is 100 coins', () => {
  assert.strictEqual(config.currency.firstWinOfDayBonus, 100);
});

test('hint and undo progression is AI-only', () => {
  assert.strictEqual(config.hintsAndUndos.aiOnly, true);
  assert.deepStrictEqual(config.hintsAndUndos.hintCosts, [25, 50, 100, 200]);
  assert.deepStrictEqual(config.hintsAndUndos.undoCosts, [50, 100, 200]);
});

test('skill slots unlock through ads only', () => {
  assert.strictEqual(config.skillSlots.slot2Cost, undefined);
  assert.strictEqual(config.skillSlots.slot2AdsRequired, 3);
  assert.strictEqual(config.skills.maxCharges, 5);
  assert.strictEqual(config.skills.refillSingleCost, 50);
  assert.strictEqual(config.skills.refillPackCost, 120);
  assert.strictEqual(config.skills.adRefillCharges, 2);
});

test('skills are ordered from standard to special and by cost', () => {
  assert.deepStrictEqual(config.skills.startingUnlocked, ['second', 'jump']);
  assert.deepStrictEqual(
    config.skills.catalog.map((skill) => skill.name),
    ['Second Chance', 'Pegasus Jump', 'Piece Freeze', 'Tactical Swap', 'Divine Shield']
  );
  const costs = config.skills.catalog.map((skill) => skill.cost);
  assert.deepStrictEqual(costs, [...costs].sort((a, b) => a - b));
  assert.ok(config.skills.startingUnlocked.includes('second'));
});

test('every purchasable board has a unique id and level gate', () => {
  const ids = config.boards.map((b) => b.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.deepStrictEqual(ids, [
    'classic-oak', 'ember', 'moonlit', 'sakura', 'walnut-maple', 'ebony-ivory'
  ]);
  config.boards.forEach((board) => {
    assert.ok(Number.isFinite(board.reqLevel) && board.reqLevel >= 1);
    assert.ok(Number.isFinite(board.cost) && board.cost >= 0);
  });
});

test('daily ad caps and first-ad bonus are configured', () => {
  assert.strictEqual(config.ads.rewardCoins, 100);
  assert.strictEqual(config.ads.firstAdOfDayBonus, 150);
  assert.strictEqual(config.ads.maxDailyRewarded, 6);
  assert.strictEqual(config.ads.maxDailyDoublers, 3);
});

test('app wiring calls initEconomy and awards match payouts once', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
  assert.ok(app.includes('this.initEconomy();'), 'initEconomy must be called from app init/profile load');
  assert.ok(app.includes('this.awardMatchEconomy(outcome, mode);'), 'recordGameResult must award economy');
  assert.ok(app.includes("if (this.statsRecordedForGame === sessionKey) return;"), 'match award must be idempotent');
  assert.ok(app.includes('Hints are disabled in competitive PvP'), 'hints must be blocked in online PvP');
});

test('storage accepts all purchasable board ids', () => {
  const storage = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'storage-service.js'), 'utf8');
  config.boards.forEach((board) => {
    assert.ok(storage.includes(`'${board.id}'`), `storage-service must allow ${board.id}`);
  });
});

console.log(`\n${passed} economy tests passed.`);
