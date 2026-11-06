const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ChessEngine = require('../public/js/chess-engine.js');

console.log('--- RUNNING ABILITY & CHAT SYNC UNIT TESTS ---');

// Test 1: ChessEngine Second Chance (1 move vs 2 moves)
{
  const engine = new ChessEngine();
  // 1. e4 (white)
  engine.makeMove(6, 4, 4, 4);
  assert.strictEqual(engine.currentTurn, 'black');
  
  // White uses second chance immediately after their move
  const ok1 = engine.validateAbility('second', null, 'white');
  assert.strictEqual(ok1, true, 'Second chance immediately after own move should succeed');
  assert.strictEqual(engine.currentTurn, 'white', 'Turn should revert to white');
  assert.strictEqual(engine.getPiece(4, 4), null, 'Pawn on e4 should be reverted');
  assert.strictEqual(engine.getPiece(6, 4).type, 'pawn', 'Pawn on e2 should be back');

  // Now play: 1. e4 (white), 1... e5 (black)
  const engine2 = new ChessEngine();
  engine2.makeMove(6, 4, 4, 4); // White: e4
  engine2.makeMove(1, 4, 3, 4); // Black: e5
  assert.strictEqual(engine2.currentTurn, 'white', 'Should be white turn on move 2');

  // White is on their turn and uses second chance (reverting e5 and e4 back to move 1)
  const ok2 = engine2.validateAbility('second', null, 'white');
  assert.strictEqual(ok2, true, 'Second chance on own turn should revert opponent response and own move');
  assert.strictEqual(engine2.currentTurn, 'white', 'Turn should be white to replay move 1');
  assert.strictEqual(engine2.getPiece(3, 4), null, 'Black piece e5 should be reverted');
  assert.strictEqual(engine2.getPiece(4, 4), null, 'White piece e4 should be reverted');
  console.log('✔ ChessEngine Second Chance (1-move & 2-move rollback) verified');
}

// Prepare BridgeMultiplayerClient environment
const bridgeMpPath = path.join(__dirname, '../public/js/bridge-multiplayer.js');
const bridgeMpCode = fs.readFileSync(bridgeMpPath, 'utf8');

let sentData = null;
const fakeWindow = {
  app: {
    getPreferredDisplayName: () => 'ammar',
    username: 'ammar',
    getSelectedAvatarSrc: () => 'pfp-01.png',
    selectedAbilities: ['second']
  },
  bridge: {
    multiplayer: {
      send: (event, payload) => {
        sentData = { event, payload };
      }
    }
  }
};

const evalContext = new Function('window', bridgeMpCode + '; return BridgeMultiplayerClient;');
const BridgeMultiplayerClient = evalContext(fakeWindow);

// Test 2: BridgeMultiplayer Chat Self-Display
{
  const bmp = new BridgeMultiplayerClient();
  bmp.playerColor = 'white';
  bmp._selfProfile = { username: 'ammar' };

  let receivedChat = null;
  bmp.onChatMessage = (color, name, text) => {
    receivedChat = { color, name, text };
  };

  bmp.sendChatMessage('kallu reply');
  assert.ok(receivedChat, 'Chat message should trigger local onChatMessage');
  assert.strictEqual(receivedChat.color, 'white');
  assert.strictEqual(receivedChat.name, 'ammar');
  assert.strictEqual(receivedChat.text, 'kallu reply');
  console.log('✔ BridgeMultiplayer local chat message display verified');
}

// Test 3: BridgeMultiplayer Ability Triggering & Forwarding
{
  const bmp = new BridgeMultiplayerClient();
  bmp.playerColor = 'white';

  let localAbility = null;
  bmp.onAbilityUsed = (ability, args, color) => {
    localAbility = { ability, args, color };
  };

  bmp.send({ type: 'use_ability', ability: 'freeze', args: { row: 1, col: 4 } });

  assert.ok(localAbility, 'Local onAbilityUsed must be invoked');
  assert.strictEqual(localAbility.ability, 'freeze');
  assert.strictEqual(localAbility.color, 'white');

  assert.ok(sentData, 'Ability must be sent over bridge');
  assert.strictEqual(sentData.event, 'game_event');
  assert.strictEqual(sentData.payload.type, 'ability_used');
  assert.strictEqual(sentData.payload.ability, 'freeze');
  assert.strictEqual(sentData.payload.color, 'white');
  console.log('✔ BridgeMultiplayer use_ability local execution & network transmission verified');

  // Test 4: Incoming ability from peer
  let remoteAbility = null;
  bmp.onAbilityUsed = (ability, args, color) => {
    remoteAbility = { ability, args, color };
  };

  bmp._handleMessage({ data: { type: 'ability_used', ability: 'shield', args: { row: 6, col: 3 }, color: 'black' } });
  assert.ok(remoteAbility, 'Remote ability must be received');
  assert.strictEqual(remoteAbility.ability, 'shield');
  assert.strictEqual(remoteAbility.color, 'black');
  console.log('✔ BridgeMultiplayer incoming ability handling verified');
}

console.log('--- ALL ABILITY & CHAT SYNC TESTS PASSED! ---');
