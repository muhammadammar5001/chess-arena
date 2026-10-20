async function finishGame(room, reason, winnerColor) {
    if (!room || room.engine.gameOver) return;
    
    room.engine.gameOver = true;
    room.engine.gameResult = { winner: winnerColor, reason: reason };
    
    let signature = null;
    let settlementData = null;
    
    if (winnerColor !== 'draw' && winnerColor !== null && room.players[winnerColor] && room.players[winnerColor].walletAddress) {
        try {
            const matchId = room.gameId || 'match-' + Date.now();
            const rulesVersion = 1;
            const winnerAddress = room.players[winnerColor].walletAddress;
            const loserColor = winnerColor === 'white' ? 'black' : 'white';
            const loserAddress = (room.players[loserColor] && room.players[loserColor].walletAddress) ? room.players[loserColor].walletAddress : winnerAddress;
            
            const stakeAmount = ethers.parseEther((room.stake || 50).toString());
            const payoutAmount = ethers.parseEther((room.stake ? room.stake * 1.8 : 90).toString());
            const feeAmount = ethers.parseEther((room.stake ? room.stake * 0.1 : 5).toString());
            const referralAmount = ethers.parseEther((room.stake ? room.stake * 0.1 : 5).toString());
            const nonce = Math.floor(Math.random() * 1000000);
            const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours
            
            const domain = {
                name: "OwlsGambit",
                version: "1",
                chainId: CHAIN_ID,
                verifyingContract: ESCROW_CONTRACT_ADDRESS
            };
            
            const types = {
                Settlement: [
                    { name: "matchId", type: "string" },
                    { name: "rulesVersion", type: "uint256" },
                    { name: "winner", type: "address" },
                    { name: "loser", type: "address" },
                    { name: "stakeAmount", type: "uint256" },
                    { name: "payoutAmount", type: "uint256" },
                    { name: "feeAmount", type: "uint256" },
                    { name: "referralAmount", type: "uint256" },
                    { name: "chainId", type: "uint256" },
                    { name: "escrowContract", type: "address" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };
            
            const value = {
                matchId, rulesVersion, winner: winnerAddress, loser: loserAddress,
                stakeAmount, payoutAmount, feeAmount, referralAmount,
                chainId: CHAIN_ID, escrowContract: ESCROW_CONTRACT_ADDRESS, nonce, deadline
            };
            
                        signature = await operatorWallet.signTypedData(domain, types, value);
            
            // Record match in Database
            db.recordMatch({
                matchId, winnerAddress, loserAddress, reason,
                stake: stakeAmount.toString() / 1e18, 
                moves: room.engine.history ? room.engine.history.length : 0,
                duration: room.gameStartTime ? Math.floor((Date.now() - room.gameStartTime) / 60000) + ' min ' + Math.floor(((Date.now() - room.gameStartTime) % 60000) / 1000) + ' sec' : 'Unknown'
            });
            settlementData = {
                matchId, rulesVersion, winner: winnerAddress, loser: loserAddress,
                stakeAmount: stakeAmount.toString(), payoutAmount: payoutAmount.toString(), 
                feeAmount: feeAmount.toString(), referralAmount: referralAmount.toString(),
                nonce, deadline, signature, escrowContract: ESCROW_CONTRACT_ADDRESS
            };
            
            // AUTOMATIC PAYOUT LOGIC
            const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
            const operatorWithProvider = operatorWallet.connect(provider);
            const abi = [
                "function settleMatch(string matchId, uint256 rulesVersion, address winner, address loser, uint256 stakeAmount, uint256 payoutAmount, uint256 feeAmount, uint256 referralAmount, uint256 nonce, uint256 deadline, bytes signature) external"
            ];
            const escrow = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, abi, operatorWithProvider);
            
            console.log("Automatically executing settleMatch on-chain for winner:", winnerAddress);
            const tx = await escrow.settleMatch(
                matchId, rulesVersion, winnerAddress, loserAddress,
                stakeAmount, payoutAmount, feeAmount, referralAmount,
                nonce, deadline, signature
            );
            await tx.wait();
            console.log("Payout successful! TX:", tx.hash);
            
        } catch (err) {
            console.error("Failed to execute automatic payout:", err);
        }
    }
    

    // --- MongoDB Stat Tracking ---
    try {
        const p1Wallet = room.players.white ? room.players.white.walletAddress : null;
        const p2Wallet = room.players.black ? room.players.black.walletAddress : null;
        if (p1Wallet && p2Wallet && typeof User !== 'undefined') {
            const u1 = await User.findOne({ walletAddress: p1Wallet.toLowerCase() });
            const u2 = await User.findOne({ walletAddress: p2Wallet.toLowerCase() });
            
            if (u1 && u2) {
                const k = 32;
                const expected1 = 1 / (1 + Math.pow(10, (u2.elo - u1.elo) / 400));
                const expected2 = 1 / (1 + Math.pow(10, (u1.elo - u2.elo) / 400));
                
                let s1 = 0.5, s2 = 0.5;
                if (winnerColor === 'white') {
                    s1 = 1; s2 = 0;
                    u1.wins = (u1.wins || 0) + 1;
                    u2.losses = (u2.losses || 0) + 1;
                } else if (winnerColor === 'black') {
                    s1 = 0; s2 = 1;
                    u1.losses = (u1.losses || 0) + 1;
                    u2.wins = (u2.wins || 0) + 1;
                } else {
                    u1.draws = (u1.draws || 0) + 1;
                    u2.draws = (u2.draws || 0) + 1;
                }
                
                u1.elo = Math.round(u1.elo + k * (s1 - expected1));
                u2.elo = Math.round(u2.elo + k * (s2 - expected2));
                
                await u1.save();
                await u2.save();
                console.log(`[Stats] White (${u1.username}) ELO: ${u1.elo}, Black (${u2.username}) ELO: ${u2.elo}`);
            }
        }
    } catch (err) {
        console.error("Failed to update MongoDB stats:", err);
    }
    // -----------------------------

    broadcastToRoom(room, { type: 'game_over', reason: reason, winner: winnerColor, settlement: settlementData, autoPaid: true });
}

/**
 * Owl's Gambit — Server
 * Express static server + WebSocket for real-time multiplayer chess.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { ethers } = require('ethers');
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Mock key for testing
const operatorWallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY);
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '31337');

const path = require('path');
const ChessEngine = require('./public/js/chess-engine.js');


require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Friendship = require('./models/Friendship');

// Connect to MongoDB
const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (dbUri) {
  mongoose.connect(dbUri)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
} else {
  console.warn('⚠️ No MONGO_URI found in .env. Running without persistent database.');
}

const app = express();
db.connectDB(process.env.MONGODB_URI);
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res, path) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); } }));

// ─── Room Management ────────────────────────────────────────────────

const rooms = new Map();
const matchmakingQueue = [];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > 3600000) { // 1 hour
      rooms.delete(code);
      console.log(`Room ${code} cleaned up (inactive)`);
    }
  }
}

// Cleanup every 10 minutes
setInterval(cleanupRooms, 600000);

// Server-side timer enforcement — tick every second
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (!room.timers || !room.lastMoveTime || room.engine.gameOver) continue;
    if (!room.players.white || !room.players.black) continue;

    const currentTurn = room.engine.currentTurn;
    const elapsed = now - room.lastMoveTime;
    const remaining = room.timers[currentTurn] - elapsed;

    if (remaining <= 0) {
      room.timers[currentTurn] = 0;
      room.engine.gameOver = true;
      const winner = currentTurn === 'white' ? 'black' : 'white';
      room.engine.gameResult = { winner, reason: 'timeout' };

      sendJSON(room.players.white, { type: 'game_over', reason: 'timeout', winner });
      sendJSON(room.players.black, { type: 'game_over', reason: 'timeout', winner });
    }
  }
}, 1000);

// ─── WebSocket Handling ─────────────────────────────────────────────

wss.on('connection', (ws) => {
  ws.id = uuidv4();
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      return;
    }

    handleMessage(ws, data);
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

// Heartbeat — 45s is more tunnel-friendly (Cloudflare, ngrok, etc.)
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 45000);

wss.on('close', () => clearInterval(heartbeat));

function sendJSON(ws, data) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify(data));
  }
}

function broadcastToRoom(room, data) {
  if (room.players.white) sendJSON(room.players.white, data);
  if (room.players.black) sendJSON(room.players.black, data);
  if (room.spectators) {
    room.spectators.forEach(ws => sendJSON(ws, data));
  }
}

function handleMessage(ws, data) {
  switch (data.type) {
    
    case 'authenticate':
      handleAuthenticate(ws, data);
      break;
    case 'set_username':
      handleSetUsername(ws, data);
      break;
    case 'invite_friend':
      handleInviteFriend(ws, data);
      break;
    case 'get_friends':
      console.log('--- GET FRIENDS FIRED ---');
      handleGetFriends(ws, data);
      break;
    case 'get_friend_requests':
      handleGetFriendRequests(ws, data);
      break;
    case 'send_friend_request':
      handleSendFriendRequest(ws, data);
      break;
    case 'respond_friend_request':
      handleRespondFriendRequest(ws, data);
      break;

    case 'check_room':
      handleCheckRoom(ws, data.roomCode);
      break;
    case 'invite_rejected':
      handleInviteRejected(ws, data);
      break;
    case 'leave_private_room':
      handleLeavePrivateRoom(ws, data);
      break;
    case 'create_room':
        createRoom(ws, data.timer, data.stake, data.mode, data.abilities);
      break;
    case 'join_room':
        joinRoom(ws, data.roomCode, data.abilities);
      break;
    case 'find_match':
        handleFindMatch(ws, data.stake, data.mode, data.abilities);
      break;
    case 'cancel_match':
      handleCancelMatch(ws);
      break;
    case 'spectate_room':
      handleSpectateRoom(ws, data.roomCode, data.spectatorName);
      break;
    case 'chat_message':
      handleChatMessage(ws, data.text);
      break;
    case 'use_ability':
        handleUseAbility(ws, data);
        break;
      case 'move':
      handleMove(ws, data);
      break;
    case 'resign':
      handleResign(ws);
      break;
    case 'offer_draw':
      handleDrawOffer(ws);
      break;
    case 'accept_draw':
      handleDrawAccept(ws);
      break;
    case 'decline_draw':
      handleDrawDecline(ws);
      break;
    case 'request_rematch':
      handleRematchRequest(ws);
      break;
    case 'accept_rematch':
      handleRematchAccept(ws);
      break;
    case 'reconnect':
      handleReconnect(ws, data);
      break;
    case 'ping':
      // Client-side keepalive — reset isAlive so heartbeat doesn't kill connection
      ws.isAlive = true;
      sendJSON(ws, { type: 'pong' });
      break;
  }
}

function handleLeavePrivateRoom(ws, data) {
  if (!ws.roomCode) return;
  const code = ws.roomCode;
  const room = rooms.get(code);
  if (!room) {
    ws.roomCode = null;
    return;
  }
  if (ws.playerColor === 'white' && !room.players.black) {
    rooms.delete(code);
    ws.roomCode = null;
    console.log(`Waiting room ${code} removed after creator left manually`);
  }
}

function handleInviteRejected(ws, data) {
  const code = data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (room && room.players && room.players.white) {
    sendJSON(room.players.white, { type: 'invite_rejected_by_target' });
    rooms.delete(code);

    console.log("Room " + code + " deleted because invite was rejected.");
  }
}

function createRoom(ws, timerMinutes, stakeAmount = 50, mode = 'standard', abilities = []) {
  const roomCode = generateRoomCode();
  const gameId = uuidv4();
  const validStake = parseInt(stakeAmount) || 50;

  const room = {
    code: roomCode,
    gameId: gameId,
    players: { white: ws, black: null }, abilities: { white: (mode === 'robin' ? abilities : []), black: [] },
    engine: new ChessEngine(),
    timer: timerMinutes ? timerMinutes * 60 * 1000 : null, // Convert to ms
    timers: timerMinutes ? {
      white: timerMinutes * 60 * 1000,
      black: timerMinutes * 60 * 1000
    } : null,
    stake: validStake,
    spectators: new Set(),
    lastMoveTime: null,
    lastActivity: Date.now(),
    rematchRequested: null,
    mode: mode
  };

  rooms.set(roomCode, room);
  ws.roomCode = roomCode;
  ws.playerColor = 'white';

  sendJSON(ws, {
    type: 'room_created',
    roomCode: roomCode,
    color: 'white',
    gameId: gameId,
    stake: validStake,
    mode: mode
  });

  console.log(`Room ${roomCode} created by ${ws.id} with stake ${validStake} | Mode: ${mode} | Abilities: ${JSON.stringify(abilities)}`);
}

function handleCheckRoom(ws, roomCode) {
  if (!roomCode) {
    sendJSON(ws, { type: 'check_room_result', success: false, message: 'Please enter a room code' });
    return;
  }

  const code = roomCode.toUpperCase().trim();
  const room = rooms.get(code);

  if (!room) {
    sendJSON(ws, { type: 'check_room_result', success: false, message: 'Room not found. Check the code.' });
    return;
  }

  if (room.players.black) {
    sendJSON(ws, { type: 'check_room_result', success: false, message: 'Room is already full.' });
    return;
  }

  if (room.engine && room.engine.gameOver) {
    sendJSON(ws, { type: 'check_room_result', success: false, message: 'Game has already ended.' });
    return;
  }

  sendJSON(ws, {
    type: 'check_room_result',
    success: true,
    roomCode: code,
    stake: room.stake || 50,
    timerMinutes: room.timer ? room.timer / 60000 : null
  });
}

function joinRoom(ws, roomCode, abilities = []) {
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    sendJSON(ws, { type: 'error', message: 'Room not found' });
    return;
  }

  if (room.players.black) {
    sendJSON(ws, { type: 'error', message: 'Room is full' });
    return;
  }

  room.players.black = ws;
  room.lastActivity = Date.now();
  room.lastMoveTime = Date.now();
  ws.roomCode = code;
  ws.playerColor = 'black';
  room.abilities.black = (room.mode === 'robin') ? abilities : [];

  const roomStake = room.stake || 50;

  // Notify joiner
  sendJSON(ws, {
    type: 'game_start',
      roomCode: code,
      abilities: { self: room.abilities.black, opponent: room.abilities.white },
      color: 'black',
      gameId: room.gameId,
    opponent: (room.players.white && room.players.white.user) ? room.players.white.user.username : 'Player 1',
    timer: room.timer,
    timerMinutes: room.timer ? room.timer / 60000 : null,
    stake: roomStake,
    mode: room.mode
  });

  // Notify creator
  sendJSON(room.players.white, {
    type: 'game_start',
      roomCode: code,
      abilities: { self: room.abilities.white, opponent: room.abilities.black },
      color: 'white',
      gameId: room.gameId,
    opponent: (ws && ws.user) ? ws.user.username : 'Player 2',
    timer: room.timer,
    timerMinutes: room.timer ? room.timer / 60000 : null,
    stake: roomStake,
    mode: room.mode
  });

  console.log(`Player joined room ${code} (stake: ${roomStake})`);
}

function handleFindMatch(ws, stakeAmount = 50, mode = 'standard', abilities = []) {
  // Check if player is already in queue
  const existingIdx = matchmakingQueue.findIndex(p => p.ws === ws);
  if (existingIdx !== -1) return;

  // Find a player with the same stake amount
  const opponentIdx = matchmakingQueue.findIndex(p => p.stake === stakeAmount && p.mode === mode && p.ws.readyState === 1);

  // If no opponent found, add to queue
  if (opponentIdx === -1) {
    matchmakingQueue.push({ ws, stake: stakeAmount, mode: mode, abilities: abilities });
    sendJSON(ws, { type: 'waiting_for_match' });
    console.log(`Player ${ws.id} entered matchmaking queue for ${stakeAmount} $OWL`);
    return;
  }

  // Found opponent, pop them
  const opponentEntry = matchmakingQueue.splice(opponentIdx, 1)[0];
    const opponentWs = opponentEntry.ws;

  // Make sure the opponent hasn't disconnected
  if (opponentWs.readyState !== 1) {
    // Try again with this player
    handleFindMatch(ws, stakeAmount, mode, abilities);
    return;
  }

  const roomCode = generateRoomCode();
  const gameId = uuidv4();
  const timerMinutes = 10; // Default 10 min for matchmaking

  const room = {
    code: roomCode,
    gameId: gameId,
    players: { white: opponentWs, black: ws }, abilities: { white: (mode === 'robin' ? (opponentEntry.abilities || []) : []), black: (mode === 'robin' ? abilities : []) },
    engine: new ChessEngine(),
    timer: timerMinutes * 60 * 1000,
    timers: {
      white: timerMinutes * 60 * 1000,
      black: timerMinutes * 60 * 1000
    },
    spectators: new Set(),
    lastMoveTime: null,
    lastActivity: Date.now(),
    rematchRequested: null,
    stake: stakeAmount,
    mode: mode
  };

  rooms.set(roomCode, room);

  opponentWs.roomCode = roomCode;
  opponentWs.playerColor = 'white';
  ws.roomCode = roomCode;
  ws.playerColor = 'black';

  // Notify white
  sendJSON(opponentWs, {
    type: 'game_start', roomCode: roomCode, abilities: { self: room.abilities.white, opponent: room.abilities.black }, color: 'white', gameId: gameId,
    opponent: 'Random Player',
    timer: room.timer,
    timerMinutes: timerMinutes,
    stake: stakeAmount,
    mode: mode
  });

  // Notify black
  sendJSON(ws, {
    type: 'game_start', roomCode: roomCode, abilities: { self: room.abilities.black, opponent: room.abilities.white }, color: 'black', gameId: gameId,
    opponent: 'Random Player',
    timer: room.timer,
    timerMinutes: timerMinutes,
    stake: stakeAmount,
    mode: mode
  });

  console.log(`Random match created: Room ${roomCode} | Mode: ${mode} | Abilities: ${JSON.stringify(abilities)}`);
}

function handleCancelMatch(ws) {
  const index = matchmakingQueue.findIndex(p => p.ws === ws);
  if (index !== -1) {
    matchmakingQueue.splice(index, 1);
    console.log(`Player ${ws.id} left matchmaking queue`);
  }
}

function handleMove(ws, data) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  const color = ws.playerColor;
  if (room.engine.currentTurn !== color) {
    sendJSON(ws, { type: 'error', message: 'Not your turn' });
    return;
  }

  const from = ChessEngine.fromAlgebraic(data.from);
  const to = ChessEngine.fromAlgebraic(data.to);

  const moveResult = room.engine.makeMove(from.row, from.col, to.row, to.col, data.promotion);
  if (!moveResult) {
    sendJSON(ws, { type: 'error', message: 'Invalid move' });
    return;
  }

  room.lastActivity = Date.now();

  // Update timers
  if (room.timers) {
    const now = Date.now();
    if (room.lastMoveTime) {
      const elapsed = now - room.lastMoveTime;
      room.timers[color] -= elapsed;

      if (room.timers[color] <= 0) {
        room.timers[color] = 0;
        const winner = color === 'white' ? 'black' : 'white';

        finishGame(room, 'timeout', winner);
        return;
      }
    }
  }

  room.lastMoveTime = Date.now();

  // Send move to all players & spectators
  broadcastToRoom(room, {
    type: 'opponent_move',
    from: data.from,
    to: data.to,
    promotion: data.promotion
  });

  if (room.timers) {
    broadcastToRoom(room, {
      type: 'timer_sync',
      white: room.timers.white,
      black: room.timers.black
    });
  }

  // Check game over
  if (moveResult.checkmate) {
    finishGame(room, 'checkmate', color);
  } else if (moveResult.stalemate) {
    finishGame(room, 'stalemate', null);
  } else if (room.engine.isInsufficientMaterial && room.engine.isInsufficientMaterial()) {
    finishGame(room, 'insufficient material', null);
  }
}

function handleResign(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  const winner = ws.playerColor === 'white' ? 'black' : 'white';
  finishGame(room, 'resignation', winner);
}

function handleDrawOffer(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  const opponent = ws.playerColor === 'white' ? room.players.black : room.players.white;
  if (opponent) {
    sendJSON(opponent, { type: 'draw_offered' });
  }
}

function handleDrawAccept(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  finishGame(room, 'draw agreed', null);
}

function handleDrawDecline(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  const opponent = ws.playerColor === 'white' ? room.players.black : room.players.white;
  if (opponent) {
    sendJSON(opponent, { type: 'error', message: 'Draw offer declined' });
  }
}

function handleRematchRequest(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  room.rematchRequested = ws.playerColor;
  const opponent = ws.playerColor === 'white' ? room.players.black : room.players.white;
  if (opponent) {
    sendJSON(opponent, { type: 'rematch_requested' });
  }
}

function handleRematchAccept(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  // Swap colors
  const temp = room.players.white;
  room.players.white = room.players.black;
  room.players.black = temp;

  if (room.players.white) room.players.white.playerColor = 'white';
  if (room.players.black) room.players.black.playerColor = 'black';

  // Reset game
  room.engine = new ChessEngine();
  room.gameId = uuidv4();
  room.lastMoveTime = Date.now();
  room.rematchRequested = null;

  if (room.timers && room.timer) {
    room.timers = { white: room.timer, black: room.timer };
  }

  sendJSON(room.players.white, {
    type: 'rematch_accepted',
    color: 'white',
    gameId: room.gameId
  });
  sendJSON(room.players.black, {
    type: 'rematch_accepted',
    color: 'black',
    gameId: room.gameId
  });
}

function handleReconnect(ws, data) {
  const room = rooms.get(data.roomCode);
  if (!room || room.gameId !== data.gameId) {
    sendJSON(ws, { type: 'error', message: 'Game not found' });
    return;
  }

  const color = data.color;
  if (!color || (color !== 'white' && color !== 'black' && color !== 'spectator')) {
    sendJSON(ws, { type: 'error', message: 'Invalid color' });
    return;
  }

  if (color === 'spectator') {
    ws.roomCode = data.roomCode;
    ws.playerColor = 'spectator';
    room.spectators.push(ws);
    
    const moveList = room.engine.moveHistory.map(m => { if (m.ability) return m; return { from: ChessEngine.toAlgebraic(m.from.row, m.from.col), to: ChessEngine.toAlgebraic(m.to.row, m.to.col), promotion: m.promotion || null }; });

    sendJSON(ws, {
      type: 'game_reconnect',
        mode: room.mode,
        color: 'spectator',
      gameId: room.gameId,
      opponent: 'Watching',
      timer: room.timer,
      timerMinutes: room.timer ? room.timer / 60000 : null,
      moves: moveList,
      abilities: { self: [], opponent: [] },
        abilitiesUsed: room.engine.abilitiesUsed,
        timers: room.timers ? {
        white: room.timers.white - (room.engine.currentTurn === 'white' ? Date.now() - room.lastMoveTime : 0),
        black: room.timers.black - (room.engine.currentTurn === 'black' ? Date.now() - room.lastMoveTime : 0)
      } : null
    });
    return;
  }

  const oldSocket = room.players[color];
  if (oldSocket && oldSocket !== ws) {
    try { oldSocket.terminate(); } catch (e) {}
  }

  room.players[color] = ws;
  ws.roomCode = data.roomCode;
  ws.playerColor = color;

  const opponentColor = color === 'white' ? 'black' : 'white';
  const opponent = room.players[opponentColor];
  if (opponent && opponent.readyState === 1) {
    sendJSON(opponent, { type: 'opponent_reconnected' });
  }

  const moveList = room.engine.moveHistory.map(m => { if (m.ability) return m; return { from: ChessEngine.toAlgebraic(m.from.row, m.from.col), to: ChessEngine.toAlgebraic(m.to.row, m.to.col), promotion: m.promotion || null }; });

  sendJSON(ws, {
    type: 'game_reconnect',
    mode: room.mode,
    color: color,
    abilities: { self: room.abilities[color], opponent: room.abilities[color === 'white' ? 'black' : 'white'] },
    gameId: room.gameId,
    opponent: opponent ? (opponent.id || 'Player') : 'Waiting...',
    timer: room.timer,
    timerMinutes: room.timer ? room.timer / 60000 : null,
    moves: moveList,
        abilitiesUsed: room.engine.abilitiesUsed,
        timers: room.timers ? {
      white: room.timers.white - (room.engine.currentTurn === 'white' ? Date.now() - room.lastMoveTime : 0),
      black: room.timers.black - (room.engine.currentTurn === 'black' ? Date.now() - room.lastMoveTime : 0)
    } : null
  });

  console.log('Player ' + color + ' reconnected to room ' + data.roomCode);
}

function handleSpectateRoom(ws, roomCode, spectatorName) {
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    sendJSON(ws, { type: 'error', message: 'Room not found' });
    return;
  }

  room.spectators.add(ws);
  ws.roomCode = code;
  ws.playerColor = 'spectator';
  ws.spectatorName = spectatorName || 'Spectator';

  // Build move history
  const moveList = room.engine.moveHistory.map(m => { if (m.ability) return m; return { from: ChessEngine.toAlgebraic(m.from.row, m.from.col), to: ChessEngine.toAlgebraic(m.to.row, m.to.col), promotion: m.promotion || null }; });

  sendJSON(ws, {
    type: 'spectator_joined',
    roomCode: code,
    gameId: room.gameId,
    timer: room.timer,
    timerMinutes: room.timer ? room.timer / 60000 : null,
    moves: moveList,
      abilities: { self: [], opponent: [] },
        abilitiesUsed: room.engine.abilitiesUsed,
        timers: room.timers ? {
      white: room.timers.white - (room.engine.currentTurn === 'white' && room.lastMoveTime ? Date.now() - room.lastMoveTime : 0),
      black: room.timers.black - (room.engine.currentTurn === 'black' && room.lastMoveTime ? Date.now() - room.lastMoveTime : 0)
    } : null
  });

  console.log(`Spectator joined room ${code}`);
}

function handleChatMessage(ws, text) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  const sender = ws.playerColor; // 'white', 'black', or 'spectator'
  let senderName = 'Spectator';
  if (sender === 'white') senderName = 'White';
  else if (sender === 'black') senderName = 'Black';
  else if (ws.spectatorName) senderName = ws.spectatorName;

  broadcastToRoom(room, {
    type: 'chat_message',
    sender: sender,
    senderName: senderName,
    text: text
  });
}

function handleDisconnect(ws) {
  handleCancelMatch(ws); // Remove from queue if they were searching

  if (!ws.roomCode) return;

  const room = rooms.get(ws.roomCode);
  if (!room) return;

  if (ws.playerColor === 'spectator') {
    room.spectators.delete(ws);
    console.log(`Spectator disconnected from room ${ws.roomCode}`);
    return;
  }

  // If creator disconnects while still waiting for an opponent to join
  if (ws.playerColor === 'white' && !room.players.black) {
    rooms.delete(ws.roomCode);
    console.log(`Waiting room ${ws.roomCode} removed after creator disconnected`);
    return;
  }

  const opponentColor = ws.playerColor === 'white' ? 'black' : 'white';
  const opponent = room.players[opponentColor];

  if (opponent && opponent.readyState === 1) {
    sendJSON(opponent, { type: 'opponent_disconnected' });
  }

  console.log(`Player disconnected from room ${ws.roomCode}`);
}

// ─── Start Server ───────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n  🦉 Owl's Gambit is running!`);
  console.log(`  ➜ Local:   http://localhost:${PORT}`);
  console.log(`  ➜ Network: http://0.0.0.0:${PORT}\n`);
});





function handleUseAbility(ws, data) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room || !room.engine || room.engine.gameOver) return;

  const color = ws.playerColor;
  if (color === 'spectator') return;

  const ability = data.ability;
  const args = data.args;

  const success = room.engine.validateAbility(ability, args, color);
  if (success) {
    room.lastActivity = Date.now();
    if (!room.engine.abilitiesUsed[color].includes(ability)) {
      room.engine.abilitiesUsed[color].push(ability);
    }

    broadcastToRoom(room, {
      type: 'ability_used',
      color: color,
      ability: ability,
      args: args
    });
  } else {
    sendJSON(ws, { type: 'error', message: 'Invalid ability use' });
  }
}


















async function handleAuthenticate(ws, data) {
  console.log('Received authenticate request for wallet:', data.walletAddress);
  if (!mongoose.connection.readyState) {
    return sendJSON(ws, { type: 'error', message: 'Database not connected' });
  }
  
  const wallet = data.walletAddress;
  if (!wallet) return;

  try {
    let user = await User.findOne({ walletAddress: wallet.toLowerCase() });
    
    if (user && user.username) {
      ws.user = user;
      sendJSON(ws, { type: 'auth_success', user: { username: user.username, elo: user.elo, wins: user.wins, losses: user.losses } });
    } else {
      sendJSON(ws, { type: 'auth_require_username', walletAddress: wallet });
    }
  } catch (err) {
    console.error('Auth error:', err);
    sendJSON(ws, { type: 'error', message: 'Authentication failed' });
  }
}

async function handleSetUsername(ws, data) {
  console.log('Received set_username for wallet:', data.walletAddress);
  if (!mongoose.connection.readyState) return;
  
  const wallet = data.walletAddress;
  const username = data.username;
  
  if (!wallet || !username || username.trim().length < 3) {
    return sendJSON(ws, { type: 'error', message: 'Invalid username' });
  }

  try {
    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return sendJSON(ws, { type: 'error', message: 'Username already taken' });
    }

    let user = await User.findOne({ walletAddress: wallet.toLowerCase() });
    if (!user) {
      user = new User({ walletAddress: wallet.toLowerCase(), username: username.trim() });
    } else {
      user.username = username.trim();
    }
    await user.save();
    
    ws.user = user;
    sendJSON(ws, { type: 'auth_success', user: { username: user.username, elo: user.elo, wins: user.wins, losses: user.losses } });
  } catch (err) {
    console.error('Set username error:', err);
    sendJSON(ws, { type: 'error', message: 'Failed to set username' });
  }
}



async function handleGetFriends(ws, data) {
  let user = ws.user;
  if (!user && data && data.walletAddress) {
    user = await User.findOne({ walletAddress: data.walletAddress.toLowerCase() });
    if (user) ws.user = user;
  }
  if (!user) return sendJSON(ws, { type: 'friends_list', friends: [] });
  try {
    const friendships = await Friendship.find({
      $or: [{ requester: user._id }, { recipient: user._id }],
      status: 'accepted'
    }).populate('requester', 'username elo').populate('recipient', 'username elo');

    const friends = [];
    friendships.forEach(f => {
      try {
        if (!f.requester || !f.recipient) return;
        const reqId = f.requester._id ? f.requester._id.toString() : f.requester.toString();
        const userId = user._id.toString();
        const isRequester = reqId === userId;
        const friend = isRequester ? f.recipient : f.requester;
        friends.push({ username: friend.username || 'Unknown', elo: friend.elo || 1200 });
      } catch (e) { console.error("Map error", e); }
    });

    console.log('[GetFriends] returning friends:', friends);
    sendJSON(ws, { type: 'friends_list', friends });
  } catch (err) {
    console.error('[GetFriends]', err);
    sendJSON(ws, { type: 'friends_list', friends: [] });
  }
}

async function handleGetFriendRequests(ws) {
  if (!ws.user) return;
  try {
    const requests = await Friendship.find({ recipient: ws.user._id, status: 'pending' }).populate('requester', 'username');
    const formatted = requests.map(r => ({ id: r._id, username: r.requester.username }));
    sendJSON(ws, { type: 'friend_requests_list', requests: formatted });
  } catch (err) {
    console.error(err);
  }
}

async function handleSendFriendRequest(ws, data) {
  let user = ws.user;
  if (!user && data && data.walletAddress) {
    user = await User.findOne({ walletAddress: data.walletAddress.toLowerCase() });
    if (user) ws.user = user;
  }
  if (!user) return sendJSON(ws, { type: 'friend_request_error', message: 'Please connect your wallet first' });
  // Swap ws.user reference to resolved user
  ws.user = user;
  try {
    const target = await User.findOne({ username: { $regex: new RegExp("^" + data.targetUsername + "$", "i") } });
    if (!target) return sendJSON(ws, { type: 'friend_request_error', message: 'User not found' });
    if (target._id.equals(ws.user._id)) return sendJSON(ws, { type: 'friend_request_error', message: 'Cannot add yourself' });
    
    const existing = await Friendship.findOne({
      $or: [
        { requester: ws.user._id, recipient: target._id },
        { requester: target._id, recipient: ws.user._id }
      ]
    });
    
    if (existing) return sendJSON(ws, { type: 'friend_request_error', message: 'Request already exists or already friends' });

    const newReq = await Friendship.create({ requester: ws.user._id, recipient: target._id });
    sendJSON(ws, { type: 'friend_request_success', message: 'Request sent to ' + target.username });

    // Notify target if online
    wss.clients.forEach(client => {
      if (client.user && client.user._id.equals(target._id) && client.readyState === 1 /* OPEN */) {
        sendJSON(client, { type: 'friend_request_received', request: { id: newReq._id, username: ws.user.username } });
      }
    });
  } catch (err) {
    console.error(err);
    sendJSON(ws, { type: 'friend_request_error', message: 'Failed to send request' });
  }
}

async function handleRespondFriendRequest(ws, data) {
  let user = ws.user;
  if (!user && data && data.walletAddress) {
    user = await User.findOne({ walletAddress: data.walletAddress.toLowerCase() });
    if (user) ws.user = user;
  }
  if (!user) return;
  try {
    const req = await Friendship.findOne({ _id: data.requestId, recipient: ws.user._id, status: 'pending' });
    if (!req) return;
    
    req.status = data.action; // 'accepted' or 'declined'
    await req.save();
    
    // In a real app we'd notify the requester they were accepted, but for now just acknowledge
    if (data.action === 'accepted') {
      sendJSON(ws, { type: 'friend_request_success', message: 'Friend request accepted!' });
      // Refresh friends list for the recipient
      handleGetFriends(ws, data);
      // Also notify the requester (original sender) if online
      const populatedReq = await Friendship.findById(req._id).populate('requester', 'username elo');
      wss.clients.forEach(client => {
        if (client.user && client.user._id.equals(populatedReq.requester._id) && client.readyState === 1) {
          handleGetFriends(client, { walletAddress: client.user.walletAddress });
        }
      });
    }
    
    // Refresh pending requests list for this user
    handleGetFriendRequests(ws, data);
  } catch (err) {
    console.error(err);
  }
}

async function handleInviteFriend(ws, data) {
  try {
    console.log('[DEBUG] Received invite_friend request for target:', data.targetUsername);
    const User = require('./models/User');
    const targetUser = await User.findOne({ username: data.targetUsername });
    if (!targetUser) {
      console.log('[DEBUG] Target user not found in DB:', data.targetUsername);
      return;
    }
    
    let inviteSent = false;
    wss.clients.forEach(c => {
      if (c.user && c.user._id && targetUser._id && c.user._id.toString() === targetUser._id.toString() && c.readyState === 1) {
        console.log('[DEBUG] Sending game_invite to connected client:', c.user.username);
        sendJSON(c, { 
          type: 'game_invite', 
          sender: ws.user ? ws.user.username : 'Unknown', 
          roomCode: data.roomCode,
          stake: data.stake,
          mode: data.mode
        });
        inviteSent = true;
      }
    });
    if (!inviteSent) console.log('[DEBUG] Target user is not connected or readyState is not 1');
  } catch(err) {
    console.error("Invite friend error:", err);
  }
}
