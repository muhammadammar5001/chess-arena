const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTING V1.0.12 REALISTIC HUMAN OPPONENTS & PLATFORM INTEGRITY ---');

// Test 1: BridgeMultiplayer has realistic human opponent pool with no (AI) labels
const bridgeMpPath = path.join(__dirname, '../public/js/bridge-multiplayer.js');
const bridgeMpSrc = fs.readFileSync(bridgeMpPath, 'utf8');

assert.ok(!bridgeMpSrc.includes('Grandmaster Leo'), 'Old bot names like Grandmaster Leo should be replaced');
assert.ok(bridgeMpSrc.includes('Alex_94'), 'Realistic human names like Alex_94 must be present');
assert.ok(bridgeMpSrc.includes('Elena_R'), 'Realistic human names like Elena_R must be present');
assert.ok(bridgeMpSrc.includes('Daniel_V'), 'Realistic human names like Daniel_V must be present');

const appSrc = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
assert.ok(!appSrc.includes('`${rawOppName} (AI)`'), '(AI) suffix must not be appended to opponent name');
console.log('✔ Test 1 Passed: Realistic human player pool active with clean, natural usernames');

// Test 2: AdService rewarded fallback
const adServiceClass = require('../public/js/ad-service.js');
const adService = new adServiceClass();
assert.strictEqual(adService.isRewardedAvailable(), true, 'isRewardedAvailable should always return true');
assert.strictEqual(adService.isInterstitialAvailable(), true, 'isInterstitialAvailable should always return true');

adService.showRewarded('test_reward').then(res => {
  assert.strictEqual(res.rewarded, true, 'Fallback rewarded should be true');
  assert.strictEqual(Boolean(res), true, 'Result should be truthy');
  console.log('✔ Test 2 Passed: Rewarded ads fallback cleanly and guarantee reward');
});

// Test 3: Leaderboard sync timeout and config
assert.ok(appSrc.includes('timeout = setTimeout(() => controller.abort(), 25000);'), 'Leaderboard sync timeout must be 25000ms');
assert.ok(appSrc.includes('chessarena_cached_leaderboard'), 'Cached leaderboard persistence must be implemented');

const configSrc = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/playgama-bridge-config.json'), 'utf8'));
assert.ok(configSrc.saas.leaderboards.platforms.includes('playgama_sandbox'), 'playgama_sandbox must be in platforms');
assert.ok(configSrc.saas.leaderboards.platforms.includes('standalone'), 'standalone must be in platforms');
console.log('✔ Test 3 Passed: Leaderboard cold-start tolerance and multi-platform SaaS support verified');
