/**
 * Chess Arena — Server
 * Express static server + WebSocket for real-time multiplayer chess.
 */

async function finishGame(room, reason, winnerColor) {
  if (!room || !room.engine || room.engine.gameOver) return;

  room.engine.gameOver = true;
  room.engine.gameResult = { winner: winnerColor, reason: reason };

  // --- MongoDB stat tracking (online only) ---
  let updatedStats = null;
  try {
    const p1 = room.players.white ? room.players.white.playerId : null;
    const p2 = room.players.black ? room.players.black.playerId : null;
    if (p1 && p2 && mongoose.connection.readyState === 1) {
      const u1 = await User.findOne({ playerId: p1.toLowerCase() });
      const u2 = await User.findOne({ playerId: p2.toLowerCase() });

      if (u1 && u2) {
        const k = 32;
        const expected1 = 1 / (1 + Math.pow(10, (u2.elo - u1.elo) / 400));
        const expected2 = 1 / (1 + Math.pow(10, (u1.elo - u2.elo) / 400));

        let s1 = 0.5;
        let s2 = 0.5;
        if (winnerColor === 'white') {
          s1 = 1; s2 = 0;
          u1.wins = (u1.wins || 0) + 1;
          u2.losses = (u2.losses || 0) + 1;
          u1.winStreak = (u1.winStreak || 0) + 1;
          u2.winStreak = 0;
        } else if (winnerColor === 'black') {
          s1 = 0; s2 = 1;
          u1.losses = (u1.losses || 0) + 1;
          u2.wins = (u2.wins || 0) + 1;
          u1.winStreak = 0;
          u2.winStreak = (u2.winStreak || 0) + 1;
        } else {
          u1.draws = (u1.draws || 0) + 1;
          u2.draws = (u2.draws || 0) + 1;
          u1.winStreak = 0;
          u2.winStreak = 0;
        }

        u1.elo = Math.round(u1.elo + k * (s1 - expected1));
        u2.elo = Math.round(u2.elo + k * (s2 - expected2));
        u1.totalMatches = (u1.wins || 0) + (u1.losses || 0) + (u1.draws || 0);
        u2.totalMatches = (u2.wins || 0) + (u2.losses || 0) + (u2.draws || 0);
        u1.bestStreak = Math.max(u1.bestStreak || 0, u1.winStreak || 0);
        u2.bestStreak = Math.max(u2.bestStreak || 0, u2.winStreak || 0);
        u1.lastUpdated = new Date();
        u2.lastUpdated = new Date();

        await u1.save();
        await u2.save();
        updatedStats = {
          white: {
            elo: u1.elo,
            wins: u1.wins || 0,
            losses: u1.losses || 0,
            draws: u1.draws || 0,
            totalMatches: u1.totalMatches || 0,
            winStreak: u1.winStreak || 0,
            bestStreak: u1.bestStreak || 0
          },
          black: {
            elo: u2.elo,
            wins: u2.wins || 0,
            losses: u2.losses || 0,
            draws: u2.draws || 0,
            totalMatches: u2.totalMatches || 0,
            winStreak: u2.winStreak || 0,
            bestStreak: u2.bestStreak || 0
          }
        };
        console.log(`[Stats] White (${u1.username}) ELO: ${u1.elo}, Black (${u2.username}) ELO: ${u2.elo}`);
      }
    }
  } catch (err) {
    console.error('Failed to update MongoDB stats:', err);
  }

  broadcastToRoom(room, { type: 'game_over', reason: reason, winner: winnerColor });

  if (updatedStats) {
    if (room.players.white) sendJSON(room.players.white, { type: 'stats_update', gameId: room.gameId, stats: updatedStats.white });
    if (room.players.black) sendJSON(room.players.black, { type: 'stats_update', gameId: room.gameId, stats: updatedStats.black });
  }
}
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const ChessEngine = require('./public/js/chess-engine.js');
const User = require('./models/User');

// Connect to MongoDB (optional: the game runs without it, stats stay local)
const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI;
let mongoConnectionError = null;
let mongoConnectionErrorName = null;
let mongoConnectionErrorCode = null;
if (dbUri) {
  mongoose.connect(dbUri)
    .then(async () => {
      console.log('Connected to MongoDB');
      try {
        await migrateUserIndexes();
      } catch (err) {
        console.error('User index migration warning:', err.message);
      }
    })
    .catch(err => {
      mongoConnectionError = classifyMongoError(err);
      mongoConnectionErrorName = (err && err.name) || 'Error';
      mongoConnectionErrorCode = err && err.code ? String(err.code) : null;
      console.error('MongoDB connection error:', err.message);
    });
} else {
  console.warn('No MONGO_URI set. Running without persistent profiles.');
}

function classifyMongoError(err) {
  const message = String((err && err.message) || '');
  if (/whitelist|not whitelisted|IP address|not allowed to access/i.test(message)) return 'network_whitelist';
  if (/authentication failed|bad auth|invalid username|invalid password|credentials/i.test(message)) return 'authentication';
  if (/ENOTFOUND|querySrv|DNS/i.test(message)) return 'dns';
  if (/ECONNREFUSED|ETIMEDOUT|server selection|connection timed out/i.test(message)) return 'network';
  return 'connection_failed';
}

/**
 * Remove the pre-rebrand wallet index, which was unique and non-sparse and
 * therefore rejected every second profile created without a walletAddress.
 * Also create the playerId index expected by automatic identities.
 */
async function migrateUserIndexes() {
  const collection = User.collection;
  const indexes = await collection.indexes();
  if (indexes.some((index) => index.name === 'walletAddress_1')) {
    await collection.dropIndex('walletAddress_1');
    console.log('[Migration] Dropped legacy walletAddress index');
  }

  const walletCleanup = await collection.updateMany(
    { walletAddress: { $exists: true } },
    { $unset: { walletAddress: '' } }
  );
  if (walletCleanup.modifiedCount) {
    console.log(`[Migration] Removed walletAddress from ${walletCleanup.modifiedCount} profile(s)`);
  }

  await collection.createIndex({ playerId: 1 }, { unique: true, sparse: true });
  await collection.createIndex({ username: 1 }, { unique: true, sparse: true });
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); } }));
app.use(express.json({ limit: '16kb' }));

// ─── CORS & Cloud Health Endpoints (YouTube Playables / Render) ─────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Chess Arena Realtime Multiplayer',
    uptime: Math.floor(process.uptime()),
    activeRooms: rooms.size,
    matchmakingQueue: matchmakingQueue.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  res.status(200).json({
    name: 'Chess Arena Multiplayer Server',
    version: '1.0.0',
    platform: 'YouTube Playables / Playgama',
    connections: wss.clients.size,
    activeRooms: rooms.size,
    mongoConfigured: Boolean(dbUri),
    mongoState: mongoose.connection.readyState,
    mongoError: mongoConnectionError,
    mongoErrorName: mongoConnectionErrorName,
    mongoErrorCode: mongoConnectionErrorCode
  });
});

// ─── Room Management ────────────────────────────────────────────────

const rooms = new Map();
const matchmakingQueue = [];
const DISCONNECT_FORFEIT_MS = Math.max(
  1000,
  Number(process.env.DISCONNECT_FORFEIT_MS) || 60000
);
// Fallback standings when MongoDB is unavailable or briefly disconnected.
const memoryProfiles = new Map();

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

function getTimersAt(room, activeColor = room.engine.currentTurn, now = Date.now()) {
  if (!room || !room.timers) return null;
  const elapsed = room.lastMoveTime ? Math.max(0, now - room.lastMoveTime) : 0;
  return {
    white: Math.max(0, room.timers.white - (activeColor === 'white' ? elapsed : 0)),
    black: Math.max(0, room.timers.black - (activeColor === 'black' ? elapsed : 0))
  };
}

// Server-side timer enforcement — tick every second. The server is the single
// source of truth: clients receive the remaining time every second so a
// throttled/paused background tab cannot drift away from the opponent.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (!room.timers || !room.lastMoveTime || room.engine.gameOver) continue;
    if (!room.players.white || !room.players.black) continue;

    // 0. Disconnect grace period. This is independent of whose turn it is so
    // the connected player is not forced to keep moving while waiting.
    if (room.disconnectedAt) {
      for (const color of ['white', 'black']) {
        const disconnectedSince = room.disconnectedAt[color];
        if (!disconnectedSince || now - disconnectedSince < DISCONNECT_FORFEIT_MS) continue;

        const disconnectedPlayer = room.players[color];
        if (disconnectedPlayer && disconnectedPlayer.readyState === 1) {
          room.disconnectedAt[color] = null;
          continue;
        }

        const opponentColor = color === 'white' ? 'black' : 'white';
        const opponent = room.players[opponentColor];
        if (opponent && opponent.readyState === 1) {
          console.log(`[Disconnect] ${color} abandoned room ${code}; awarding win to ${opponentColor}`);
          finishGame(room, 'abandonment', opponentColor);
          break;
        }
      }
      if (room.engine.gameOver) continue;
    }

    const currentTurn = room.engine.currentTurn;
    const timers = getTimersAt(room, currentTurn, now);

    // 1. Total 10-minute clock expiration
    if (timers[currentTurn] <= 0) {
      room.timers[currentTurn] = 0;
      const winner = currentTurn === 'white' ? 'black' : 'white';
      finishGame(room, 'timeout', winner);
      continue;
    }

    // 2. Per-move 60-second timer & 2-strike inactivity check
    if (!room.moveStartTime) room.moveStartTime = room.lastMoveTime || now;
    if (!room.afkStrikes) room.afkStrikes = { white: 0, black: 0 };

    const moveLimit = 45000;
    const elapsedMove = Math.max(0, now - room.moveStartTime);
    const moveTimeLeft = Math.max(0, moveLimit - elapsedMove);

    if (elapsedMove >= moveLimit) {
      room.afkStrikes[currentTurn] = (room.afkStrikes[currentTurn] || 0) + 1;
      const strikeCount = room.afkStrikes[currentTurn];

      // Deduct elapsed time from player's total match clock
      const elapsedMatch = Math.max(0, now - room.lastMoveTime);
      room.timers[currentTurn] = Math.max(0, room.timers[currentTurn] - elapsedMatch);
      room.lastMoveTime = now;
      room.moveStartTime = now;

      if (strikeCount === 1) {
        // Strike 1: Pass turn to opponent & send AFK warning modal to inactive player
        const inactiveColor = currentTurn;
        const activeColor = currentTurn === 'white' ? 'black' : 'white';

        room.engine.passTurn('afk_pass');

        const inactiveSocket = room.players[inactiveColor];
        if (inactiveSocket && inactiveSocket.readyState === 1) {
          sendJSON(inactiveSocket, {
            type: 'afk_warning',
            strikes: 1,
            maxStrikes: 2,
            message: 'You missed your move within 45 seconds. Your turn was passed to your opponent! If you miss again, you will forfeit the match.'
          });
        }

        broadcastToRoom(room, {
          type: 'turn_passed',
          passedBy: inactiveColor,
          newTurn: activeColor,
          reason: 'afk_timeout',
          strikes: 1,
          white: room.timers.white,
          black: room.timers.black,
          moveTimeLeft: moveLimit
        });

        broadcastToRoom(room, {
          type: 'timer_sync',
          white: room.timers.white,
          black: room.timers.black,
          moveTimeLeft: moveLimit,
          activeTurn: activeColor,
          serverTime: now
        });
        continue;
      } else {
        // Strike >= 2: Auto-forfeit on inactivity, opponent wins
        const winner = currentTurn === 'white' ? 'black' : 'white';
        finishGame(room, 'abandonment', winner);
        continue;
      }
    }

    broadcastToRoom(room, {
      type: 'timer_sync',
      white: timers.white,
      black: timers.black,
      moveTimeLeft: moveTimeLeft,
      activeTurn: currentTurn,
      serverTime: now
    });
  }
}, 1000);

// ─── WebSocket Handling ─────────────────────────────────────────────

wss.on('connection', (ws) => {
  ws.id = uuidv4();
  ws.isAlive = true;
  ws.username = 'Player';
  ws.rating = 1200;
  ws.avatarId = 'pfp-01';
  ws.avatarSrc = null;
  ws.playerLevel = 1;

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
}, 25000);

wss.on('close', () => clearInterval(heartbeat));

function sendJSON(ws, data) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify(data));
  }
}

function getSocketProfile(ws) {
  const user = ws && ws.user;
  const rawName = (user && user.username) || (ws && ws.displayName);
  let username = sanitizeDisplayName(rawName);
  if (!username) username = ws && ws.playerId ? fallbackUsername(ws.playerId) : 'Player';
  const rawRating = user && user.elo != null ? user.elo : (ws && ws.playerRating);
  const rating = Math.min(4000, Math.max(100, safeInt(rawRating, 1200)));
  const level = Math.min(999, Math.max(1, safeInt(ws && ws.playerLevel, 1)));
  const avatarId = (ws && ws.avatarId) ? ws.avatarId : 'pfp-01';
  return { username, rating, level, avatarId };
}

function broadcastToRoom(room, data) {
  if (room.players.white) sendJSON(room.players.white, data);
  if (room.players.black) sendJSON(room.players.black, data);
}

function handleMessage(ws, data) {
  switch (data.type) {
    
    case 'authenticate':
      handleAuthenticate(ws, data);
      break;
    case 'set_username':
      handleSetUsername(ws, data);
      break;
    case 'check_room':
      handleCheckRoom(ws, data.roomCode);
      break;
    case 'leave_private_room':
      handleLeavePrivateRoom(ws, data);
      break;
    case 'create_room':
        createRoom(ws, data.timer, data.mode, data.abilities, data.avatarId);
      break;
    case 'join_room':
        joinRoom(ws, data.roomCode, data.abilities, data.avatarId);
      break;
    case 'find_match':
        handleFindMatch(ws, data.mode, data.abilities, data.avatarId);
      break;
    case 'cancel_match':
      handleCancelMatch(ws);
      break;
    case 'chat_message':
      handleChatMessage(ws, data.text || data.message, data.roomCode);
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

function createRoom(ws, timerMinutes, mode = 'standard', abilities = [], avatarId = null) {
  if (avatarId) ws.avatarId = avatarId;
  const roomCode = generateRoomCode();
  const gameId = uuidv4();
  // Private rooms always use the standard 10-minute clock.
  const roomTimerMinutes = 10;

  const room = {
    code: roomCode,
    gameId: gameId,
    players: { white: ws, black: null },
    abilities: { white: mode === 'tactical' ? abilities : [], black: [] },
    engine: new ChessEngine(),
    timer: roomTimerMinutes * 60 * 1000,
    timers: {
      white: roomTimerMinutes * 60 * 1000,
      black: roomTimerMinutes * 60 * 1000
    },
    moveStartTime: null,
    afkStrikes: { white: 0, black: 0 },
    lastMoveTime: null,
    lastActivity: Date.now(),
    rematchRequested: null,
    disconnectedAt: { white: null, black: null },
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
    mode: mode
  });

  console.log(`Room ${roomCode} created by ${ws.id} | Mode: ${mode} | Abilities: ${JSON.stringify(abilities)}`);
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
    timerMinutes: room.timer ? room.timer / 60000 : null
  });
}

function joinRoom(ws, roomCode, abilities = [], avatarId = null) {
  if (avatarId) ws.avatarId = avatarId;
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
  room.moveStartTime = Date.now();
  room.afkStrikes = { white: 0, black: 0 };
  ws.roomCode = code;
  ws.playerColor = 'black';
  room.abilities.black = room.mode === 'tactical' ? abilities : [];

  const whiteProfile = getSocketProfile(room.players.white);
  const blackProfile = getSocketProfile(ws);
  const startTimers = getTimersAt(room, 'white', Date.now());

  sendJSON(ws, {
    type: 'game_start',
    roomCode: code,
    abilities: { self: room.abilities.black, opponent: room.abilities.white },
    color: 'black',
    gameId: room.gameId,
    opponent: whiteProfile.username,
    opponentProfile: whiteProfile,
    selfProfile: blackProfile,
    timer: room.timer,
    timerMinutes: room.timer ? room.timer / 60000 : null,
    timers: startTimers,
    mode: room.mode
  });

  sendJSON(room.players.white, {
    type: 'game_start',
    roomCode: code,
    abilities: { self: room.abilities.white, opponent: room.abilities.black },
    color: 'white',
    gameId: room.gameId,
    opponent: blackProfile.username,
    opponentProfile: blackProfile,
    selfProfile: whiteProfile,
    timer: room.timer,
    timerMinutes: room.timer ? room.timer / 60000 : null,
    timers: startTimers,
    mode: room.mode
  });

  console.log(`Player joined room ${code}`);
}

function handleFindMatch(ws, mode = 'standard', abilities = [], avatarId = null) {
  if (avatarId) ws.avatarId = avatarId;
  const existingIdx = matchmakingQueue.findIndex(p => p.ws === ws);
  if (existingIdx !== -1) return;

  const opponentIdx = matchmakingQueue.findIndex(p => p.mode === mode && p.ws.readyState === 1);

  if (opponentIdx === -1) {
    matchmakingQueue.push({ ws, mode: mode, abilities: abilities, avatarId: avatarId });
    sendJSON(ws, { type: 'waiting_for_match' });
    console.log(`Player ${ws.id} entered matchmaking queue`);
    return;
  }

  const opponentEntry = matchmakingQueue.splice(opponentIdx, 1)[0];
  const opponentWs = opponentEntry.ws;
  if (opponentEntry.avatarId) opponentWs.avatarId = opponentEntry.avatarId;
  if (opponentWs.readyState !== 1) {
    handleFindMatch(ws, mode, abilities);
    return;
  }

  const roomCode = generateRoomCode();
  const gameId = uuidv4();
  const timerMinutes = 10;

  const room = {
    code: roomCode,
    gameId: gameId,
    players: { white: opponentWs, black: ws },
    abilities: {
      white: mode === 'tactical' ? (opponentEntry.abilities || []) : [],
      black: mode === 'tactical' ? abilities : []
    },
    engine: new ChessEngine(),
    timer: timerMinutes * 60 * 1000,
    timers: {
      white: timerMinutes * 60 * 1000,
      black: timerMinutes * 60 * 1000
    },
    moveStartTime: Date.now(),
    afkStrikes: { white: 0, black: 0 },
    lastMoveTime: Date.now(),
    lastActivity: Date.now(),
    rematchRequested: null,
    disconnectedAt: { white: null, black: null },
    mode: mode
  };

  rooms.set(roomCode, room);
  const startTimers = getTimersAt(room, 'white', room.lastMoveTime);

  opponentWs.roomCode = roomCode;
  opponentWs.playerColor = 'white';
  ws.roomCode = roomCode;
  ws.playerColor = 'black';

  const whiteProfile = getSocketProfile(opponentWs);
  const blackProfile = getSocketProfile(ws);

  sendJSON(opponentWs, {
    type: 'game_start', roomCode: roomCode, abilities: { self: room.abilities.white, opponent: room.abilities.black }, color: 'white', gameId: gameId,
    opponent: blackProfile.username, opponentProfile: blackProfile, selfProfile: whiteProfile,
    timer: room.timer, timerMinutes: timerMinutes, timers: startTimers, mode: mode
  });

  sendJSON(ws, {
    type: 'game_start', roomCode: roomCode, abilities: { self: room.abilities.black, opponent: room.abilities.white }, color: 'black', gameId: gameId,
    opponent: whiteProfile.username, opponentProfile: whiteProfile, selfProfile: blackProfile,
    timer: room.timer, timerMinutes: timerMinutes, timers: startTimers, mode: mode
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

  if (room.engine.gameOver) {
    sendJSON(ws, { type: 'error', message: 'Game is over' });
    return;
  }

  const color = ws.playerColor;
  if (room.engine.currentTurn !== color) {
    sendJSON(ws, { type: 'error', message: 'Not your turn' });
    return;
  }

  const isValidSquare = (value) => typeof value === 'string' && /^[a-h][1-8]$/.test(value);
  if (!isValidSquare(data.from) || !isValidSquare(data.to)) {
    sendJSON(ws, { type: 'error', message: 'Invalid move' });
    return;
  }

  const from = ChessEngine.fromAlgebraic(data.from);
  const to = ChessEngine.fromAlgebraic(data.to);

  // Multiplayer is server-authoritative: never force an illegal move.
  const moveResult = room.engine.makeMove(from.row, from.col, to.row, to.col, data.promotion, true);
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
  room.moveStartTime = Date.now();

  // Send move to both players
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
      black: room.timers.black,
      moveTimeLeft: 45000,
      activeTurn: room.engine.currentTurn
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
  room.moveStartTime = Date.now();
  room.afkStrikes = { white: 0, black: 0 };
  room.disconnectedAt = { white: null, black: null };
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
  if (!color || (color !== 'white' && color !== 'black')) {
    sendJSON(ws, { type: 'error', message: 'Invalid color' });
    return;
  }

  const oldSocket = room.players[color];
  if (oldSocket && oldSocket !== ws) {
    try { oldSocket.terminate(); } catch (e) {}
  }

  room.players[color] = ws;
  ws.roomCode = data.roomCode;
  ws.playerColor = color;
  room.lastActivity = Date.now();
  if (room.disconnectedAt) room.disconnectedAt[color] = null;

  const opponentColor = color === 'white' ? 'black' : 'white';
  const opponent = room.players[opponentColor];
  if (opponent && opponent.readyState === 1) {
    sendJSON(opponent, { type: 'opponent_reconnected' });
  }

  const moveList = room.engine.moveHistory.map(m => { if (m.ability) return m; return { from: ChessEngine.toAlgebraic(m.from.row, m.from.col), to: ChessEngine.toAlgebraic(m.to.row, m.to.col), promotion: m.promotion || null }; });

  const selfProfile = getSocketProfile(ws);
  const opponentProfile = opponent
    ? getSocketProfile(opponent)
    : { username: 'Waiting...', rating: 1200, level: 1 };

  sendJSON(ws, {
    type: 'game_reconnect',
    mode: room.mode,
    color: color,
    abilities: { self: room.abilities[color], opponent: room.abilities[color === 'white' ? 'black' : 'white'] },
    gameId: room.gameId,
    opponent: opponentProfile.username,
    opponentProfile,
    selfProfile,
    timer: room.timer,
    timerMinutes: room.timer ? room.timer / 60000 : null,
    moves: moveList,
    abilitiesUsed: room.engine.abilitiesUsed,
    timers: getTimersAt(room, room.engine.currentTurn, Date.now()),
    moveTimeLeft: Math.max(0, 45000 - (Date.now() - (room.moveStartTime || room.lastMoveTime || Date.now())))
  });

  console.log('Player ' + color + ' reconnected to room ' + data.roomCode);
}

function handleChatMessage(ws, text, roomCode) {
  if (!text || typeof text !== 'string') return;
  const cleanText = text.trim().slice(0, 200);
  if (!cleanText) return;

  const targetRoomCode = ws.roomCode || roomCode;
  if (!targetRoomCode) return;
  const room = rooms.get(targetRoomCode);
  if (!room) return;

  const sender = ws.playerColor || 'spectator';
  let senderName = 'Spectator';
  if (sender === 'white') senderName = 'White';
  else if (sender === 'black') senderName = 'Black';
  else if (ws.spectatorName) senderName = ws.spectatorName;

  broadcastToRoom(room, {
    type: 'chat_message',
    sender: sender,
    senderName: senderName,
    text: cleanText
  });
}

function handleDisconnect(ws) {
  handleCancelMatch(ws); // Remove from queue if they were searching

  if (!ws.roomCode) return;

  const room = rooms.get(ws.roomCode);
  if (!room) return;

  // If creator disconnects while still waiting for an opponent to join
  if (ws.playerColor === 'white' && !room.players.black) {
    rooms.delete(ws.roomCode);
    console.log(`Waiting room ${ws.roomCode} removed after creator disconnected`);
    return;
  }

  if (!ws.playerColor) return;

  // A finished result should stay stable while players view the recap or
  // negotiate a rematch; only an active game starts the forfeit countdown.
  if (room.engine && room.engine.gameOver) {
    console.log(`Player disconnected after game over in room ${ws.roomCode}`);
    return;
  }

  if (!room.disconnectedAt) room.disconnectedAt = { white: null, black: null };
  room.disconnectedAt[ws.playerColor] = Date.now();
  room.lastActivity = Date.now();

  const opponentColor = ws.playerColor === 'white' ? 'black' : 'white';
  const opponent = room.players[opponentColor];

  if (opponent && opponent.readyState === 1) {
    sendJSON(opponent, {
      type: 'opponent_disconnected',
      forfeitInMs: DISCONNECT_FORFEIT_MS
    });
  }

  console.log(`Player disconnected from room ${ws.roomCode}; forfeit in ${DISCONNECT_FORFEIT_MS}ms`);
}

// ─── Start Server ───────────────────────────────────────────────────

// ─── Leaderboard sync and standings ─────────────────────────────────

function safeInt(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function sanitizeLeaderboardUsername(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
}

const MAX_STAT_COUNT = 10000000;
function cappedCount(value) {
  return Math.min(MAX_STAT_COUNT, Math.max(0, safeInt(value, 0)));
}

function profileTotal(profile) {
  return cappedCount(profile && profile.wins) +
    cappedCount(profile && profile.losses) +
    cappedCount(profile && profile.draws);
}

function profileStatsPayload(profile) {
  const wins = cappedCount(profile && profile.wins);
  const losses = cappedCount(profile && profile.losses);
  const draws = cappedCount(profile && profile.draws);
  const winStreak = cappedCount(profile && profile.winStreak);
  return {
    wins,
    losses,
    draws,
    totalMatches: wins + losses + draws,
    winStreak,
    bestStreak: Math.max(winStreak, cappedCount(profile && profile.bestStreak))
  };
}

function normalizeLeaderboardPayload(body) {
  const playerId = String(body && body.playerId ? body.playerId : '').trim().toLowerCase().slice(0, 64);
  if (!/^[a-z0-9_:-]{6,64}$/.test(playerId)) {
    return { error: 'Invalid playerId' };
  }

  const username = sanitizeLeaderboardUsername(body.username);
  if (username.length < 3) {
    return { error: 'Username must be 3-16 alphanumeric characters' };
  }

  const rawStats = body.stats && typeof body.stats === 'object' ? body.stats : {};
  const wins = cappedCount(rawStats.wins);
  const losses = cappedCount(rawStats.losses);
  const draws = cappedCount(rawStats.draws);
  const winStreak = cappedCount(rawStats.winStreak);
  const bestStreak = Math.max(winStreak, cappedCount(rawStats.bestStreak));
  const rating = Math.min(4000, Math.max(100, safeInt(
    body.rating != null ? body.rating : body.elo,
    1200
  )));

  return {
    playerId,
    username,
    rating,
    wins,
    losses,
    draws,
    totalMatches: wins + losses + draws,
    winStreak,
    bestStreak
  };
}

function leaderboardRow(profile, rank) {
  const wins = cappedCount(profile.wins);
  const losses = cappedCount(profile.losses);
  const draws = cappedCount(profile.draws);
  const rating = Math.min(4000, Math.max(100, safeInt(profile.elo != null ? profile.elo : profile.rating, 1200)));
  return {
    rank,
    playerId: profile.playerId || null,
    username: profile.username,
    rating,
    elo: rating,
    wins,
    losses,
    draws,
    totalMatches: wins + losses + draws,
    winStreak: Math.max(0, safeInt(profile.winStreak, 0)),
    bestStreak: Math.max(0, safeInt(profile.bestStreak, 0))
  };
}

function sortedMemoryRows() {
  return Array.from(memoryProfiles.values())
    .filter((profile) => profile.username)
    .sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
      return String(a.username).localeCompare(String(b.username));
    });
}

function memoryLeaderboardData(limit, playerId) {
  const rows = sortedMemoryRows();
  const topPlayers = rows.slice(0, limit).map((profile, index) => leaderboardRow(profile, index + 1));
  const currentIndex = playerId ? rows.findIndex((profile) => profile.playerId === playerId) : -1;
  return {
    topPlayers,
    totalPlayers: rows.length,
    currentRank: currentIndex >= 0 ? currentIndex + 1 : null
  };
}

async function uniqueMongoUsername(base, playerId) {
  let candidate = base;
  let counter = 2;
  while (await User.exists({ username: candidate, playerId: { $ne: playerId } })) {
    const suffix = String(counter++);
    candidate = base.slice(0, 16 - suffix.length) + suffix;
    if (counter > 999) {
      candidate = base.slice(0, 10) + Math.random().toString(36).slice(2, 6);
      break;
    }
  }
  return candidate;
}

async function upsertMongoLeaderboardProfile(profile) {
  let username = profile.username;
  const existing = await User.findOne({ playerId: profile.playerId });
  if (!existing || existing.username !== username) {
    username = await uniqueMongoUsername(username, profile.playerId);
  }

  const update = {
    username,
    lastUpdated: new Date()
  };

  // The server is authoritative after an online result. A client reconnecting
  // with an older cloud profile must never erase a newer PvP result from the
  // database. Only a strictly larger total (offline progress) advances the
  // server stats; equal totals keep the server's authoritative Elo/streak.
  const incomingTotal = profileTotal(profile);
  const existingTotal = existing ? profileTotal(existing) : 0;
  if (!existing || incomingTotal > existingTotal) {
    update.elo = profile.rating;
    update.wins = profile.wins;
    update.losses = profile.losses;
    update.draws = profile.draws;
    update.totalMatches = profile.totalMatches;
    update.winStreak = profile.winStreak;
    update.bestStreak = profile.bestStreak;
  }

  try {
    return await User.findOneAndUpdate(
      { playerId: profile.playerId },
      { $set: update, $setOnInsert: { createdAt: new Date() } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    // A concurrent sync may have claimed the requested username.
    if (err && err.code === 11000) {
      update.username = await uniqueMongoUsername(profile.username, profile.playerId);
      return await User.findOneAndUpdate(
        { playerId: profile.playerId },
        { $set: update, $setOnInsert: { createdAt: new Date() } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );
    }
    throw err;
  }
}

async function mongoLeaderboardData(limit, playerId, currentProfile) {
  const query = { username: { $exists: true, $ne: null } };
  const [users, totalPlayers] = await Promise.all([
    User.find(query).sort({ elo: -1, wins: -1, username: 1 }).limit(limit).lean(),
    User.countDocuments(query)
  ]);

  let currentRank = null;
  if (playerId) {
    const user = currentProfile || await User.findOne({ playerId }).lean();
    if (user && user.username) {
      const elo = safeInt(user.elo, 1200);
      const wins = Math.max(0, safeInt(user.wins, 0));
      const better = await User.countDocuments({
        username: { $exists: true, $ne: null },
        $or: [
          { elo: { $gt: elo } },
          { elo, wins: { $gt: wins } },
          { elo, wins, username: { $lt: user.username } }
        ]
      });
      currentRank = better + 1;
    }
  }

  return {
    topPlayers: users.map((user, index) => leaderboardRow(user, index + 1)),
    totalPlayers,
    currentRank
  };
}

function syncMemoryProfile(profile) {
  let username = profile.username;
  let counter = 2;
  while (Array.from(memoryProfiles.values()).some((entry) =>
    entry.playerId !== profile.playerId && entry.username === username)) {
    const suffix = String(counter++);
    username = profile.username.slice(0, 16 - suffix.length) + suffix;
    if (counter > 999) break;
  }

  const existing = memoryProfiles.get(profile.playerId);
  const incomingTotal = profileTotal(profile);
  const existingTotal = existing ? profileTotal(existing) : 0;
  const keepExisting = existing && existingTotal >= incomingTotal;
  const source = keepExisting ? existing : profile;
  const sourceElo = safeInt(source.elo != null ? source.elo : source.rating, 1200);
  const stored = {
    playerId: profile.playerId,
    username,
    elo: Math.min(4000, Math.max(100, sourceElo)),
    wins: cappedCount(source.wins),
    losses: cappedCount(source.losses),
    draws: cappedCount(source.draws),
    totalMatches: profileTotal(source),
    winStreak: cappedCount(source.winStreak),
    bestStreak: Math.max(cappedCount(source.winStreak), cappedCount(source.bestStreak)),
    lastUpdated: new Date()
  };
  memoryProfiles.set(profile.playerId, stored);
  return stored;
}

app.post('/api/leaderboard/sync', async (req, res) => {
  const profile = normalizeLeaderboardPayload(req.body || {});
  if (profile.error) {
    return res.status(400).json({ success: false, error: profile.error });
  }

  try {
    let data;
    let responseProfile;
    if (mongoose.connection.readyState === 1) {
      try {
        const user = await upsertMongoLeaderboardProfile(profile);
        responseProfile = {
          playerId: user.playerId,
          username: user.username,
          elo: user.elo,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
          winStreak: user.winStreak,
          bestStreak: user.bestStreak
        };
        syncMemoryProfile(responseProfile);
        data = await mongoLeaderboardData(10, profile.playerId, user);
      } catch (err) {
        console.error('Leaderboard sync DB error:', err.message);
        responseProfile = syncMemoryProfile(profile);
        data = memoryLeaderboardData(10, responseProfile.playerId);
      }
      return res.json({
        success: true,
        username: responseProfile.username,
        rating: responseProfile.elo,
        stats: profileStatsPayload(responseProfile),
        currentRank: data.currentRank,
        totalPlayers: data.totalPlayers,
        topPlayers: data.topPlayers
      });
    }

    responseProfile = syncMemoryProfile(profile);
    data = memoryLeaderboardData(10, responseProfile.playerId);
    res.json({
      success: true,
      username: responseProfile.username,
      rating: responseProfile.elo,
      stats: profileStatsPayload(responseProfile),
      currentRank: data.currentRank,
      totalPlayers: data.totalPlayers,
      topPlayers: data.topPlayers
    });
  } catch (err) {
    console.error('Leaderboard sync error:', err.message);
    res.status(500).json({ success: false, error: 'Leaderboard sync failed' });
  }
});

// Public leaderboard (Mongo when available, in-process memory otherwise)
app.get('/api/leaderboard', async (req, res) => {
  try {
    let data;
    if (mongoose.connection.readyState === 1) {
      data = await mongoLeaderboardData(100, null, null);
    } else {
      data = memoryLeaderboardData(100, null);
    }
    res.json({
      players: data.topPlayers,
      totalPlayers: data.totalPlayers
    });
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    try {
      const data = memoryLeaderboardData(100, null);
      res.json({ players: data.topPlayers, totalPlayers: data.totalPlayers });
    } catch (fallbackErr) {
      res.status(500).json({ players: [], totalPlayers: 0 });
    }
  }
});

server.listen(PORT, () => {
  console.log('\n  Chess Arena is running!');
  console.log(`  ➜ Local:   http://localhost:${PORT}`);
  console.log(`  ➜ Network: http://0.0.0.0:${PORT}\n`);
  initKeepAlive();
});

// ─── Render Self-Ping Keep-Alive Bot ─────────────────────────────────────────
// Pings /health every 10 minutes so Render free instances don't spin down / sleep.
function initKeepAlive() {
  const pingUrl = process.env.PING_URL || process.env.RENDER_EXTERNAL_URL
    ? `${(process.env.PING_URL || process.env.RENDER_EXTERNAL_URL).replace(/\/+$/, '')}/health`
    : 'https://chess-arena-262t.onrender.com/health';

  const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  // Initial delay of 2 minutes before starting pings
  setTimeout(() => {
    setInterval(async () => {
      try {
        const res = await fetch(pingUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'ChessArena-KeepAlive-Bot/1.0' }
        });
        if (res.ok) {
          console.log(`[KeepAlive] Ping successful to ${pingUrl} (status: ${res.status})`);
        } else {
          console.warn(`[KeepAlive] Ping response: ${res.status}`);
        }
      } catch (err) {
        console.warn(`[KeepAlive] Ping failed: ${err.message}`);
      }
    }, PING_INTERVAL_MS);
    console.log(`[KeepAlive] Auto-ping bot active for ${pingUrl} (every 10m)`);
  }, 2 * 60 * 1000);
}






function handleUseAbility(ws, data) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room || !room.engine || room.engine.gameOver) return;

  const color = ws.playerColor;

  const ability = data.ability;
  const args = data.args;

  const success = room.engine.validateAbility(ability, args, color);
  if (success) {
    room.lastActivity = Date.now();
    if (!room.engine.abilitiesUsed[color].includes(ability)) {
      room.engine.abilitiesUsed[color].push(ability);
    }

    // Turn-consuming abilities (swap & jump) update timers and check game over
    if (ability === 'swap' || ability === 'jump') {
      if (room.timers && room.lastMoveTime) {
        const now = Date.now();
        const elapsed = now - room.lastMoveTime;
        room.timers[color] -= elapsed;
        if (room.timers[color] <= 0) {
          room.timers[color] = 0;
          const winner = color === 'white' ? 'black' : 'white';
          broadcastToRoom(room, { type: 'game_over', reason: 'timeout', winner });
          room.engine.gameOver = true;
          room.engine.gameResult = { winner, reason: 'timeout' };
          return;
        }
      }
      room.lastMoveTime = Date.now();
      room.moveStartTime = Date.now();
    }

    broadcastToRoom(room, {
      type: 'ability_used',
      color: color,
      ability: ability,
      args: args
    });

    if (ability === 'swap' || ability === 'jump') {
      if (room.timers) {
        broadcastToRoom(room, {
          type: 'timer_sync',
          white: room.timers.white,
          black: room.timers.black,
          moveTimeLeft: 45000,
          activeTurn: room.engine.currentTurn
        });
      }

      // Check if ability resulted in checkmate / stalemate
      const opponentColor = color === 'white' ? 'black' : 'white';
      if (room.engine.isCheckmate(opponentColor)) {
        room.engine.gameOver = true;
        room.engine.gameResult = { winner: color, reason: 'checkmate' };
        broadcastToRoom(room, { type: 'game_over', reason: 'checkmate', winner: color });
      } else if (room.engine.isStalemate && room.engine.isStalemate(opponentColor)) {
        room.engine.gameOver = true;
        room.engine.gameResult = { winner: null, reason: 'stalemate' };
        broadcastToRoom(room, { type: 'game_over', reason: 'stalemate', winner: null });
      }
    }
  } else {
    sendJSON(ws, { type: 'error', message: 'Invalid ability use' });
  }
}


















function sanitizeDisplayName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

function fallbackUsername(playerId) {
  const suffix = String(playerId || '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || 'GUEST';
  return 'Player ' + suffix;
}

async function uniqueUsername(base, playerId) {
  const clean = sanitizeDisplayName(base);
  let root = clean.length >= 3 ? clean : fallbackUsername(playerId);
  if (root.length < 3) root = fallbackUsername(playerId);

  let candidate = root;
  let counter = 2;
  while (await User.exists({ username: candidate, playerId: { $ne: playerId } })) {
    const suffix = ' ' + counter;
    candidate = root.slice(0, 24 - suffix.length).trimEnd() + suffix;
    counter++;
    if (counter > 999) {
      candidate = root.slice(0, 17) + ' ' + Math.random().toString(36).slice(2, 6);
      break;
    }
  }
  return candidate;
}

async function handleAuthenticate(ws, data) {
  const rawId = data && data.playerId ? String(data.playerId).trim() : '';
  if (!rawId || rawId.length > 96) return;
  const playerId = rawId.toLowerCase();
  ws.playerId = playerId;
  ws.displayName = sanitizeDisplayName(data && data.displayName) || fallbackUsername(playerId);
  ws.playerRating = Math.min(4000, Math.max(100, safeInt(data && data.rating, 1200)));
  ws.playerLevel = Math.min(999, Math.max(1, safeInt(data && data.playerLevel, 1)));
  if (data && data.avatarId) ws.avatarId = String(data.avatarId).trim().slice(0, 32);

  // The database is optional. Without it the player still gets a full game and
  // local/Bridge-backed stats; only cross-device profile sync is unavailable.
  if (mongoose.connection.readyState !== 1) {
    return sendJSON(ws, { type: 'auth_offline' });
  }

  try {
    let user = await User.findOne({ playerId });
    let created = false;

    if (!user) {
      for (let attempt = 0; attempt < 4 && !user; attempt++) {
        const username = await uniqueUsername(data.displayName, playerId);
        try {
          user = await User.create({ playerId, username });
          created = true;
        } catch (err) {
          if (!err || err.code !== 11000) throw err;
          // Another socket may have created this player or claimed the same
          // username between the lookup and insert. Reuse the player if it now
          // exists; otherwise retry with the newly updated uniqueness state.
          user = await User.findOne({ playerId });
        }
      }
      if (!user) throw new Error('Could not create player profile');
    } else if (!user.username) {
      user.username = await uniqueUsername(data.displayName, playerId);
      await user.save();
      created = true;
    }

    ws.user = user;
    sendJSON(ws, {
      type: 'auth_success',
      created,
      user: {
        username: user.username,
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws
      }
    });
  } catch (err) {
    console.error('Auth error:', err);
    sendJSON(ws, { type: 'error', message: 'Authentication failed' });
  }
}

async function handleSetUsername(ws, data) {
  const playerId = data && data.playerId ? String(data.playerId).trim().toLowerCase() : '';
  const name = sanitizeLeaderboardUsername(data && data.username);

  if (mongoose.connection.readyState !== 1) {
    return sendJSON(ws, { type: 'error', message: 'Profiles are unavailable right now.' });
  }
  if (!playerId || name.length < 3 || name.length > 16) {
    return sendJSON(ws, { type: 'error', message: 'Username must be 3-16 alphanumeric characters' });
  }

  ws.playerId = playerId;

  try {
    const existing = await User.findOne({ username: name });
    if (existing && existing.playerId !== playerId.toLowerCase()) {
      return sendJSON(ws, { type: 'error', message: 'Username already taken' });
    }

    let user = await User.findOne({ playerId: playerId.toLowerCase() });
    if (!user) {
      user = new User({ playerId: playerId.toLowerCase(), username: name });
    } else {
      user.username = name;
    }
    await user.save();

    ws.user = user;
    ws.displayName = user.username;
    ws.playerRating = user.elo;
    sendJSON(ws, {
      type: 'auth_success',
      user: {
        username: user.username,
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws
      }
    });
  } catch (err) {
    console.error('Set username error:', err);
    sendJSON(ws, { type: 'error', message: 'Failed to set username' });
  }
}
