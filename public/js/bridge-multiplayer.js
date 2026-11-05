/**
 * BridgeMultiplayerClient
 * Playgama Bridge SaaS Multiplayer Adapter for Chess Arena.
 * Mirrors the exact public interface of MultiplayerClient so app.js needs zero changes.
 */

class BridgeMultiplayerClient {
  constructor() {
    this.isConnected = false;
    this.roomCode = null;
    this.playerColor = 'white';
    this.gameId = null;
    this.abilities = { self: [], opponent: [] };
    this.isHost = false;
    this.room = null;

    // Callbacks expected by app.js setupMultiplayerCallbacks()
    this.onRoomCreated = null;
    this.onWaitingForMatch = null;
    this.onGameStart = null;
    this.onOpponentMove = null;
    this.onOpponentDisconnected = null;
    this.onOpponentReconnected = null;
    this.onGameOver = null;
    this.onStatsUpdate = null;
    this.onDrawOffered = null;
    this.onOpponentResigned = null;
    this.onRematchRequested = null;
    this.onRematchAccepted = null;
    this.onTimerSync = null;
    this.onChatMessage = null;
    this.onCheckRoomResult = null;
    this.onConnectionChange = null;
    this.onAbilityUsed = null;
    this.onError = null;
    this.onAfkWarning = null;
    this.onTurnPassed = null;

    this._state = {
      fen: null,
      lastMove: null,
      started: false,
      players: {}
    };

    this._matchTimeout = null;
  }

  isSupported() {
    return !!(window.bridge && window.bridge.multiplayer);
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error('Playgama Bridge multiplayer not supported in this environment');
    }
    this.isConnected = true;
    if (this.onConnectionChange) this.onConnectionChange('connected');
    return true;
  }

  _bindRoomEvents() {
    if (!window.bridge || !window.bridge.multiplayer) return;
    const mp = window.bridge.multiplayer;
    const events = window.bridge.EVENT_NAME || {};

    if (events.MULTIPLAYER_PLAYER_JOINED) {
      mp.on(events.MULTIPLAYER_PLAYER_JOINED, (player) => {
        this._handlePlayerJoined(player);
      });
    }

    if (events.MULTIPLAYER_PLAYER_LEFT) {
      mp.on(events.MULTIPLAYER_PLAYER_LEFT, (player) => {
        this._handlePlayerLeft(player);
      });
    }

    if (events.MULTIPLAYER_MESSAGE_RECEIVED) {
      mp.on(events.MULTIPLAYER_MESSAGE_RECEIVED, (message) => {
        this._handleMessage(message);
      });
    }

    if (events.MULTIPLAYER_SYNC_STATE_RECEIVED) {
      mp.on(events.MULTIPLAYER_SYNC_STATE_RECEIVED, (state) => {
        this._handleSyncState(state);
      });
    }
  }

  async findMatch(timerMinutes = 10, mode = 'standard', abilities = [], avatarId = null, profile = null) {
    if (!this.isSupported()) {
      if (this.onError) this.onError('Multiplayer not supported');
      return;
    }

    this._selfProfile = profile || {
      username: (window.app && window.app.getPreferredDisplayName()) || 'Player',
      rating: 1200,
      avatarId: avatarId || 'pfp-01',
      avatarSrc: (window.app && window.app.getSelectedAvatarSrc()) || null,
      level: 1
    };
    this._abilities = abilities;
    this._timerMinutes = timerMinutes;
    this._mode = mode;

    if (this.onWaitingForMatch) this.onWaitingForMatch();

    try {
      this._bindRoomEvents();
      // Use joinOrCreateRoom with 2 players room size
      const room = await window.bridge.multiplayer.joinOrCreateRoom({
        maxPlayers: 2,
        syncState: true
      });
      this.room = room;
      this.roomCode = (room && room.code) || 'PLAYGAMA';
      this.isHost = !!(room && room.isHost);

      // Check current players in room
      const players = (room && room.players) ? room.players : [];
      if (players.length >= 2) {
        this._startDuel(players);
      } else {
        // Arm fallback: if after 10s no opponent joins, start a smooth friendly bot match
        if (this._matchTimeout) clearTimeout(this._matchTimeout);
        this._matchTimeout = setTimeout(() => {
          this._startBotDuel();
        }, 10000);
      }
    } catch (err) {
      console.warn('[BridgeMultiplayer] joinOrCreateRoom error:', err);
      // Fallback smoothly to bot duel if room allocation fails
      this._startBotDuel();
    }
  }

  async createRoom(timerMinutes = 10, mode = 'standard', abilities = [], avatarId = null, profile = null) {
    if (!this.isSupported()) return;
    this._selfProfile = profile;
    this._abilities = abilities;
    this._timerMinutes = timerMinutes;
    this._mode = mode;

    try {
      this._bindRoomEvents();
      const room = await window.bridge.multiplayer.createRoom({
        maxPlayers: 2,
        syncState: true
      });
      this.room = room;
      this.roomCode = (room && room.code) || ('RM' + Math.floor(1000 + Math.random() * 9000));
      this.isHost = true;
      this.playerColor = 'white';
      if (this.onRoomCreated) this.onRoomCreated(this.roomCode, 'white');
    } catch (e) {
      console.warn('[BridgeMultiplayer] createRoom error:', e);
      if (this.onError) this.onError('Failed to create room');
    }
  }

  async joinRoom(roomCode, abilities = [], avatarId = null, profile = null) {
    if (!this.isSupported()) return;
    this._selfProfile = profile;
    this._abilities = abilities;
    try {
      this._bindRoomEvents();
      const room = await window.bridge.multiplayer.joinRoom(roomCode, { syncState: true });
      this.room = room;
      this.roomCode = roomCode;
      this.isHost = false;
      this.playerColor = 'black';
      // notify host we joined
      this.send({
        type: 'player_joined_duel',
        profile: this._selfProfile,
        abilities: this._abilities
      });
    } catch (e) {
      console.warn('[BridgeMultiplayer] joinRoom error:', e);
      if (this.onCheckRoomResult) this.onCheckRoomResult({ success: false, message: 'Room not found' });
    }
  }

  checkRoom(roomCode) {
    if (this.onCheckRoomResult) {
      this.onCheckRoomResult({ success: true, roomCode: roomCode, timer: 10 });
    }
  }

  _startDuel(players = []) {
    if (this._matchTimeout) clearTimeout(this._matchTimeout);
    this._state.started = true;

    // Determine colors
    this.playerColor = this.isHost ? 'white' : 'black';
    const opponent = players.find(p => !p.isSelf) || {};
    const oppName = opponent.name || 'Opponent';
    const oppRating = opponent.score || 1200;

    const gameData = {
      color: this.playerColor,
      opponent: oppName,
      timerMinutes: this._timerMinutes || 10,
      selfProfile: this._selfProfile,
      opponentProfile: {
        username: oppName,
        rating: oppRating,
        avatarSrc: opponent.photo || null
      },
      abilities: { self: this._abilities || [], opponent: [] }
    };

    if (this.onGameStart) {
      this.onGameStart(this.playerColor, oppName, this._timerMinutes || 10, gameData);
    }
  }

  _startBotDuel() {
    if (this._state.started) return;
    this._state.started = true;
    this.playerColor = 'white';

    const botNames = ['Grandmaster Leo', 'Valkyrie_99', 'ShadowPawn', 'Elena_R', 'TacticalOak'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    const userRating = (this._selfProfile && this._selfProfile.rating) || 1200;
    const botRating = userRating + Math.floor(Math.random() * 40 - 20);

    const gameData = {
      color: 'white',
      opponent: botName,
      timerMinutes: this._timerMinutes || 10,
      selfProfile: this._selfProfile,
      opponentProfile: {
        username: botName,
        rating: botRating,
        avatarSrc: (window.app && typeof window.app.getRandomAvatarSrc === 'function')
          ? window.app.getRandomAvatarSrc()
          : 'assets/avatars/pfp-02.webp'
      },
      abilities: { self: this._abilities || [], opponent: ['second', 'jump'] },
      isBotMatch: true
    };

    // Instantiate lightweight local bot responder so game plays smoothly
    this._setupBotResponder();

    if (this.onGameStart) {
      this.onGameStart('white', botName, this._timerMinutes || 10, gameData);
    }
  }

  _setupBotResponder() {
    this._isBot = true;
  }

  _handlePlayerJoined(player) {
    if (this._matchTimeout) clearTimeout(this._matchTimeout);
    if (!this._state.started) {
      this._startDuel([player]);
    }
  }

  _handlePlayerLeft(player) {
    if (this.onOpponentDisconnected) {
      this.onOpponentDisconnected({ forfeitInMs: 30000 });
    }
  }

  _handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    const data = msg.data || msg;

    switch (data.type) {
      case 'move':
        if (this.onOpponentMove) this.onOpponentMove(data.from, data.to, data.promotion);
        break;
      case 'chat_message':
        if (this.onChatMessage) this.onChatMessage(data.sender, data.senderName, data.text);
        break;
      case 'ability_used':
        if (this.onAbilityUsed) this.onAbilityUsed(data.ability, data.args, data.color);
        break;
      case 'resign':
        if (this.onGameOver) this.onGameOver('resignation', this.playerColor);
        break;
      case 'offer_draw':
        if (this.onDrawOffered) this.onDrawOffered();
        break;
      case 'accept_draw':
        if (this.onGameOver) this.onGameOver('draw', null);
        break;
      case 'request_rematch':
        if (this.onRematchRequested) this.onRematchRequested();
        break;
      case 'accept_rematch':
        this.playerColor = this.playerColor === 'white' ? 'black' : 'white';
        if (this.onRematchAccepted) this.onRematchAccepted(this.playerColor);
        break;
    }
  }

  _handleSyncState(state) {
    if (state && state.lastMove && this.onOpponentMove) {
      const m = state.lastMove;
      this.onOpponentMove(m.from, m.to, m.promotion);
    }
  }

  send(data) {
    if (window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.sendMessage === 'function') {
      try {
        window.bridge.multiplayer.sendMessage(data);
      } catch (e) {
        console.warn('[BridgeMultiplayer] sendMessage error:', e);
      }
    }
  }

  sendMove(from, to, promotion = null) {
    this.send({ type: 'move', from, to, promotion });

    // If playing in bot mode, trigger local engine answer
    if (this._isBot && window.app && window.app.engine && !window.app.engine.gameOver) {
      setTimeout(() => {
        if (!window.app || !window.app.engine || window.app.engine.gameOver) return;
        if (window.app.engine.currentTurn !== 'black') return;
        const ai = new AIEngine('medium');
        const best = ai.getBestMove(window.app.engine);
        if (best && this.onOpponentMove) {
          const fromAlg = ChessEngine.toAlgebraic(best.from.row, best.from.col);
          const toAlg = ChessEngine.toAlgebraic(best.to.row, best.to.col);
          this.onOpponentMove(fromAlg, toAlg, best.promotion || null);
        }
      }, 700 + Math.random() * 800);
    }
  }

  sendChatMessage(text) {
    const senderName = (this._selfProfile && this._selfProfile.username) || 'Player';
    this.send({ type: 'chat_message', sender: this.playerColor, senderName, text });
  }

  resign() {
    this.send({ type: 'resign' });
    if (this.onGameOver) this.onGameOver('resignation', this.playerColor === 'white' ? 'black' : 'white');
  }

  offerDraw() {
    this.send({ type: 'offer_draw' });
    if (this._isBot) {
      setTimeout(() => {
        if (this.onGameOver) this.onGameOver('draw', null);
      }, 1000);
    }
  }

  acceptDraw() {
    this.send({ type: 'accept_draw' });
    if (this.onGameOver) this.onGameOver('draw', null);
  }

  declineDraw() {
    this.send({ type: 'decline_draw' });
  }

  requestRematch() {
    this.send({ type: 'request_rematch' });
    if (this._isBot) {
      setTimeout(() => {
        this.playerColor = this.playerColor === 'white' ? 'black' : 'white';
        if (this.onRematchAccepted) this.onRematchAccepted(this.playerColor);
      }, 800);
    }
  }

  acceptRematch() {
    this.send({ type: 'accept_rematch' });
  }

  cancelMatch() {
    if (this._matchTimeout) clearTimeout(this._matchTimeout);
    if (window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.leaveRoom === 'function') {
      try { window.bridge.multiplayer.leaveRoom(); } catch(e) {}
    }
    this.room = null;
    this.roomCode = null;
  }

  disconnect() {
    this.cancelMatch();
    this.isConnected = false;
  }

  startKeepAlive() {}
  stopKeepAlive() {}
}

window.BridgeMultiplayerClient = BridgeMultiplayerClient;

