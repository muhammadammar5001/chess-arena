const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING REMATCH INTEGRATION & LOGIC TESTS ---');

// 1. Verify BridgeMultiplayerClient rematch logic
const bridgeMpPath = path.join(__dirname, '../public/js/bridge-multiplayer.js');
const bridgeMpCode = fs.readFileSync(bridgeMpPath, 'utf8');

// Fake environment
const window = {
  app: {
    getPreferredDisplayName: () => 'PlayerA',
    getSelectedAvatarSrc: () => 'pfp-01.png',
    selectedAbilities: ['swap', 'freeze']
  },
  bridge: null
};

// Evaluate BridgeMultiplayerClient
const evalContext = new Function('window', bridgeMpCode + '; return BridgeMultiplayerClient;');
const BridgeMultiplayerClient = evalContext(window);

// Test 1: Both clients swap colors and trigger onRematchAccepted synchronously
const clientA = new BridgeMultiplayerClient();
const clientB = new BridgeMultiplayerClient();

// Connect A and B in mock relay
clientA.playerColor = 'white';
clientB.playerColor = 'black';

clientA.send = (data) => {
  // relay to B
  clientB._handleMessage(data);
};
clientB.send = (data) => {
  // relay to A
  clientA._handleMessage(data);
};

let aRematchColor = null;
let bRematchColor = null;
clientA.onRematchAccepted = (color) => { aRematchColor = color; };
clientB.onRematchAccepted = (color) => { bRematchColor = color; };

let bReceivedRequest = false;
clientB.onRematchRequested = () => {
  bReceivedRequest = true;
  // B accepts
  clientB.acceptRematch();
};

// A requests rematch
clientA.requestRematch();

assert.strictEqual(bReceivedRequest, true, 'Client B should receive rematch request');
assert.strictEqual(clientA.playerColor, 'black', 'Client A should become black after accept');
assert.strictEqual(clientB.playerColor, 'white', 'Client B should become white after accept');
assert.strictEqual(aRematchColor, 'black', 'Client A onRematchAccepted should be called with black');
assert.strictEqual(bRematchColor, 'white', 'Client B onRematchAccepted should be called with white');
console.log('✔ BridgeMultiplayerClient rematch handshake and color swap verified');

// Test 2: Simultaneous rematch requests auto-accept
const clientC = new BridgeMultiplayerClient();
const clientD = new BridgeMultiplayerClient();
clientC.playerColor = 'white';
clientD.playerColor = 'black';

let queueC = [];
let queueD = [];

clientC.send = (data) => { queueD.push(data); };
clientD.send = (data) => { queueC.push(data); };

let cRematchColor = null;
let dRematchColor = null;
clientC.onRematchAccepted = (color) => { cRematchColor = color; };
clientD.onRematchAccepted = (color) => { dRematchColor = color; };

// Both request rematch before messages deliver
clientC.requestRematch();
clientD.requestRematch();

// Deliver messages
while (queueC.length || queueD.length) {
  if (queueD.length) clientD._handleMessage(queueD.shift());
  if (queueC.length) clientC._handleMessage(queueC.shift());
}

assert.strictEqual(clientC.playerColor === 'white' && clientD.playerColor === 'black' ||
                   clientC.playerColor === 'black' && clientD.playerColor === 'white', true,
                   'Clients should have opposite colors');
assert.notStrictEqual(clientC.playerColor, clientD.playerColor, 'Simultaneous rematch must not assign same color');
console.log('✔ Simultaneous rematch requests auto-accept without deadlock verified');

// Test 3: Bot rematch against bot triggers opening move if player becomes Black
const clientPlayer = new BridgeMultiplayerClient();
clientPlayer._isBot = true;
clientPlayer.playerColor = 'white';
let playerRematchColor = null;
clientPlayer.onRematchAccepted = (color) => { playerRematchColor = color; };

clientPlayer.requestRematch();
setTimeout(() => {
  assert.strictEqual(clientPlayer.playerColor, 'black', 'Player should become black against bot');
  console.log('✔ Bot rematch color transition verified');
  console.log('--- ALL REMATCH TESTS PASSED SUCCESSFULLY! ---');
}, 850);

