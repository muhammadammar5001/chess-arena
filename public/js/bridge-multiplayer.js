/**
 * BridgeMultiplayerClient
 * Playgama Bridge SaaS Multiplayer Adapter for Chess Arena.
 * Uses Playgama Bridge SaaS real-time rooms & state sync (relay servers)
 * for seamless real-player PvP and room-code friend duels.
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
    this.onRematchDeclined = null;
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
    this._statusTimer = null;
    this._isBot = false;
    this._boundBridgeEvents = false;
    this._isSearching = false;
    this._searchSessionId = 0;
    this._rematchRequestedBySelf = false;
    this._rematchBotTimeout = null;
  }

  isSupported() {
    return true;
  }

  async connect() {
    this.isConnected = true;
    if (this.onConnectionChange) this.onConnectionChange('connected');
    return true;
  }

  _bindRoomEvents() {
    if (this._boundBridgeEvents) return;
    if (!window.bridge) return;

    const mp = window.bridge.multiplayer;
    const events = window.bridge.EVENT_NAME || {};

    const registerEvent = (evName, handler) => {
      if (!evName) return;
      try {
        if (mp && typeof mp.on === 'function') {
          mp.on(evName, handler);
        } else if (typeof window.bridge.on === 'function') {
          window.bridge.on(evName, handler);
        }
      } catch (e) {
        console.warn('[BridgeMultiplayer] Event subscribe notice:', evName, e);
      }
    };

    registerEvent(events.MULTIPLAYER_PLAYER_JOINED || 'multiplayer_player_joined', (player) => {
      console.log('[BridgeMultiplayer] MULTIPLAYER_PLAYER_JOINED:', player);
      this._handlePlayerJoined(player);
    });

    registerEvent(events.MULTIPLAYER_PLAYER_LEFT || 'multiplayer_player_left', (player) => {
      console.log('[BridgeMultiplayer] MULTIPLAYER_PLAYER_LEFT:', player);
      this._handlePlayerLeft(player);
    });

    registerEvent(events.MULTIPLAYER_MESSAGE_RECEIVED || 'multiplayer_message_received', (message) => {
      this._handleMessage(message);
    });

    registerEvent(events.MULTIPLAYER_SYNC_STATE_RECEIVED || 'multiplayer_sync_state_received', (state) => {
      this._handleSyncState(state);
    });

    this._boundBridgeEvents = true;
  }

  /**
   * Random matchmaking
   */
  async findMatch(timerMinutes = 10, mode = 'standard', abilities = [], avatarId = null, profile = null) {
    this._isSearching = true;
    const currentSearchId = ++this._searchSessionId;

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
    this._state.started = false;
    this._isBot = false;

    if (this.onWaitingForMatch) this.onWaitingForMatch();

    const hasNativeBridgeMP = window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.joinOrCreateRoom === 'function';

    if (hasNativeBridgeMP) {
      try {
        this._bindRoomEvents();

        const code = await window.bridge.multiplayer.joinOrCreateRoom({
          playerName: this._selfProfile.username,
          playerProperties: {
            rating: this._selfProfile.rating,
            avatarSrc: this._selfProfile.avatarSrc || '',
            abilities: this._abilities || []
          },
          maxPlayers: 2,
          filter: { gameMode: mode || 'standard' },
          syncState: true
        });

        // If search was cancelled while awaiting joinOrCreateRoom, leave and abort
        if (!this._isSearching || this._searchSessionId !== currentSearchId) {
          console.log('[BridgeMultiplayer] Matchmaking was cancelled while joining room, leaving room');
          if (window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.leaveRoom === 'function') {
            try { window.bridge.multiplayer.leaveRoom(); } catch(e) {}
          }
          this.room = null;
          this.roomCode = null;
          return;
        }

        this.roomCode = code || (window.bridge.multiplayer.room && window.bridge.multiplayer.room.id) || 'ONLINE';
        this.isHost = !!(window.bridge.multiplayer.isHost);
        this.playerColor = this.isHost ? 'white' : 'black';

        // Check if another player is already connected in the room
        const currentPlayers = window.bridge.multiplayer.players || [];
        const otherPlayer = currentPlayers.find(p => p.id !== window.bridge.multiplayer.playerId);

        if (otherPlayer) {
          if (!this._isSearching || this._searchSessionId !== currentSearchId) return;
          console.log('[BridgeMultiplayer] Found opponent immediately in room:', otherPlayer);
          this._startDuel([otherPlayer]);
          return;
        }

        // Give up to 18 seconds for another human player in quick match before fallback
        if (this._matchTimeout) clearTimeout(this._matchTimeout);
        this._matchTimeout = setTimeout(() => {
          if (this._isSearching && this._searchSessionId === currentSearchId && !this._state.started) {
            console.log('[BridgeMultiplayer] Matchmaking timeout reached, starting challenge duel');
            this._startBotDuel();
          }
        }, 18000);

        return;
      } catch (err) {
        console.warn('[BridgeMultiplayer] Native joinOrCreateRoom failed:', err);
      }
    }

    // Fallback if SDK or server is temporarily unreachable
    if (!this._isSearching || this._searchSessionId !== currentSearchId) return;
    if (this._matchTimeout) clearTimeout(this._matchTimeout);
    this._matchTimeout = setTimeout(() => {
      if (this._isSearching && this._searchSessionId === currentSearchId && !this._state.started) {
        this._startBotDuel();
      }
    }, 12000);
  }

  /**
   * Create Private Room with Room Code (Friends Duel)
   */
  async createRoom(timerMinutes = 10, mode = 'standard', abilities = [], avatarId = null, profile = null) {
    this._selfProfile = profile || {
      username: (window.app && window.app.getPreferredDisplayName()) || 'Host',
      rating: 1200,
      avatarId: avatarId || 'pfp-01',
      avatarSrc: (window.app && window.app.getSelectedAvatarSrc()) || null,
      level: 1
    };
    this._abilities = abilities;
    this._timerMinutes = timerMinutes;
    this._mode = mode;
    this._state.started = false;
    this._isBot = false;
    this.isHost = true;
    this.playerColor = 'white';

    const hasNativeBridgeMP = window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.createRoom === 'function';

    if (hasNativeBridgeMP) {
      try {
        this._bindRoomEvents();

        const code = await window.bridge.multiplayer.createRoom({
          playerName: this._selfProfile.username,
          playerProperties: {
            rating: this._selfProfile.rating,
            avatarSrc: this._selfProfile.avatarSrc || '',
            abilities: this._abilities || []
          },
          maxPlayers: 2,
          isOpen: true,
          isVisible: false, // Private room for friends only
          syncState: true
        });

        this.roomCode = code || (window.bridge.multiplayer.room && window.bridge.multiplayer.room.id);
        console.log('[BridgeMultiplayer] Private room created with code:', this.roomCode);

        if (this.onRoomCreated) {
          this.onRoomCreated(this.roomCode, 'white');
        }
        // IMPORTANT: NEVER start a bot duel for friend rooms! Wait for friend.
        return;
      } catch (e) {
        console.warn('[BridgeMultiplayer] createRoom error:', e);
      }
    }

    // Local fallback code
    this.roomCode = 'RM' + Math.floor(1000 + Math.random() * 9000);
    if (this.onRoomCreated) this.onRoomCreated(this.roomCode, 'white');
  }

  /**
   * Check Room before joining
   */
  async checkRoom(roomCode) {
    const cleanCode = String(roomCode || '').trim().toUpperCase();
    if (!cleanCode) {
      if (this.onCheckRoomResult) this.onCheckRoomResult({ success: false, message: 'Invalid room code' });
      return;
    }

    // With Playgama Bridge, room codes can be checked directly by joinRoom
    if (this.onCheckRoomResult) {
      this.onCheckRoomResult({
        success: true,
        roomCode: cleanCode,
        timerMinutes: 10
      });
    }
  }

  /**
   * Join Private Room via Code
   */
  async joinRoom(roomCode, abilities = [], avatarId = null, profile = null) {
    const cleanCode = String(roomCode || '').trim().toUpperCase();
    this._selfProfile = profile || {
      username: (window.app && window.app.getPreferredDisplayName()) || 'Guest',
      rating: 1200,
      avatarId: avatarId || 'pfp-02',
      avatarSrc: (window.app && window.app.getSelectedAvatarSrc()) || null,
      level: 1
    };
    this._abilities = abilities;
    this._state.started = false;
    this._isBot = false;
    this.isHost = false;
    this.playerColor = 'black';
    this.roomCode = cleanCode;

    const hasNativeBridgeMP = window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.joinRoom === 'function';

    if (hasNativeBridgeMP) {
      try {
        this._bindRoomEvents();

        await window.bridge.multiplayer.joinRoom(cleanCode, {
          playerName: this._selfProfile.username,
          playerProperties: {
            rating: this._selfProfile.rating,
            avatarSrc: this._selfProfile.avatarSrc || '',
            abilities: this._abilities || []
          },
          syncState: true
        });

        console.log('[BridgeMultiplayer] Successfully joined room:', cleanCode);

        // Find the host in the room
        const players = window.bridge.multiplayer.players || [];
        const hostPlayer = players.find(p => p.id !== window.bridge.multiplayer.playerId) || players[0];

        // Send hello greeting message so host gets opponent profile
        this.send({
          type: 'player_joined_duel',
          profile: this._selfProfile,
          abilities: this._abilities
        });

        if (hostPlayer) {
          this._startDuel([hostPlayer]);
        }
        return;
      } catch (e) {
        console.warn('[BridgeMultiplayer] joinRoom error:', e);
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('Room not found or expired');
        }
        if (window.app && typeof window.app.showScreen === 'function') {
          window.app.showScreen('screen-home');
        }
        return;
      }
    }

    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast('Unable to connect to room');
    }
  }

  _startDuel(players = []) {
    if (this._matchTimeout) clearTimeout(this._matchTimeout);
    if (!this._isSearching && !this.roomCode) return;
    if (this._state.started) return;
    this._isSearching = false;
    this._state.started = true;
    this._isBot = false;

    this.playerColor = this.isHost ? 'white' : 'black';
    const opponent = players.find(p => !p.isSelf && p.id !== (window.bridge && window.bridge.multiplayer && window.bridge.multiplayer.playerId)) || players[0] || {};
    const oppProps = opponent.properties || {};
    const oppName = opponent.name || oppProps.username || 'Opponent';
    const oppRating = oppProps.rating || opponent.score || 1200;
    const oppAvatar = oppProps.avatarSrc || opponent.photo || null;

    const gameData = {
      color: this.playerColor,
      opponent: oppName,
      timerMinutes: this._timerMinutes || 10,
      selfProfile: this._selfProfile,
      opponentProfile: {
        username: oppName,
        rating: oppRating,
        avatarSrc: oppAvatar
      },
      abilities: { self: this._abilities || [], opponent: oppProps.abilities || [] }
    };

    if (this.onGameStart) {
      this.onGameStart(this.playerColor, oppName, this._timerMinutes || 10, gameData);
    }
  }

  _startBotDuel() {
    if (!this._isSearching || this._state.started) return;
    this._isSearching = false;
    this._state.started = true;
    this._isBot = true;
    this.playerColor = 'white';

    const botPool = [
      { name: 'Grandmaster Leo', rating: 1240, avatar: 'assets/avatars/pfp-02.webp' },
      { name: 'Valkyrie_99', rating: 1215, avatar: 'assets/avatars/pfp-04.webp' },
      { name: 'ShadowPawn', rating: 1195, avatar: 'assets/avatars/pfp-06.webp' },
      { name: 'Elena_R', rating: 1230, avatar: 'assets/avatars/pfp-08.webp' },
      { name: 'TacticalOak', rating: 1210, avatar: 'assets/avatars/pfp-10.webp' }
    ];
    const picked = botPool[Math.floor(Math.random() * botPool.length)];

    const gameData = {
      color: 'white',
      opponent: picked.name,
      timerMinutes: this._timerMinutes || 10,
      selfProfile: this._selfProfile,
      opponentProfile: {
        username: picked.name,
        rating: picked.rating,
        avatarSrc: picked.avatar
      },
      abilities: { self: this._abilities || [], opponent: ['second', 'jump'] },
      isBotMatch: true
    };

    if (this.onGameStart) {
      this.onGameStart('white', picked.name, this._timerMinutes || 10, gameData);
    }
  }

  _handlePlayerJoined(player) {
    if (!this._isSearching && !this.roomCode) return;
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
      case 'player_joined_duel':
        if (!this._state.started && this.isHost) {
          this._startDuel([{
            name: (data.profile && data.profile.username) || 'Player',
            properties: data.profile || {}
          }]);
        }
        break;
      case 'move':
        if (this.onOpponentMove) this.onOpponentMove(data.from, data.to, data.promotion);
        break;
      case 'chat_message':
        if (this.onChatMessage) this.onChatMessage(data.sender, data.senderName, data.text);
        break;
      case 'use_ability':
      case 'ability_used': {
        const color = data.color || (this.playerColor === 'white' ? 'black' : 'white');
        if (data.ability === 'second' && this._botMoveTimer) {
          clearTimeout(this._botMoveTimer);
          this._botMoveTimer = null;
        }
        if (this.onAbilityUsed) {
          this.onAbilityUsed(data.ability, data.args, color);
        }
        this._triggerBotMoveIfNeeded();
        break;
      }
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
        if (this._rematchRequestedBySelf) {
          // Both players requested rematch independently -> auto-accept immediately!
          this.acceptRematch();
        } else if (this.onRematchRequested) {
          this.onRematchRequested();
        }
        break;
      case 'accept_rematch': {
        this._rematchRequestedBySelf = false;
        if (this._rematchBotTimeout) clearTimeout(this._rematchBotTimeout);
        if (this._botMoveTimer) clearTimeout(this._botMoveTimer);

        const myNewColor = data.color || (this.playerColor === 'white' ? 'black' : 'white');
        this.playerColor = myNewColor;
        this._state.started = true;
        this._state.lastMove = null;

        if (this.onRematchAccepted) {
          this.onRematchAccepted(this.playerColor);
        }

        if (this._isBot && this.playerColor === 'black') {
          this._triggerBotMoveIfNeeded();
        }
        break;
      }
      case 'decline_rematch':
        this._rematchRequestedBySelf = false;
        if (this._rematchBotTimeout) clearTimeout(this._rematchBotTimeout);
        if (this.onRematchDeclined) this.onRematchDeclined();
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
    if (!data || typeof data !== 'object') return;

    if (data.type === 'use_ability') {
      const color = this.playerColor;
      const ability = data.ability;
      const args = data.args || null;

      const outgoing = {
        type: 'ability_used',
        ability: ability,
        args: args,
        color: color
      };

      this._transmit(outgoing);

      if (ability === 'second' && this._botMoveTimer) {
        clearTimeout(this._botMoveTimer);
        this._botMoveTimer = null;
      }

      if (this.onAbilityUsed) {
        this.onAbilityUsed(ability, args, color);
      }

      this._triggerBotMoveIfNeeded();
      return;
    }

    this._transmit(data);
  }

  _transmit(data) {
    if (window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.send === 'function') {
      try {
        window.bridge.multiplayer.send('game_event', data);
        return;
      } catch (e) {
        console.warn('[BridgeMultiplayer] bridge.multiplayer.send error:', e);
      }
    }
    if (window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.sendMessage === 'function') {
      try {
        window.bridge.multiplayer.sendMessage(data);
        return;
      } catch (e) {
        console.warn('[BridgeMultiplayer] sendMessage fallback error:', e);
      }
    }
  }

  _triggerBotMoveIfNeeded() {
    if (!this._isBot || !window.app || !window.app.engine || window.app.engine.gameOver) return;
    const botColor = this.playerColor === 'white' ? 'black' : 'white';
    if (window.app.engine.currentTurn !== botColor) return;

    if (this._botMoveTimer) clearTimeout(this._botMoveTimer);
    this._botMoveTimer = setTimeout(() => {
      if (!window.app || !window.app.engine || window.app.engine.gameOver) return;
      if (window.app.engine.currentTurn !== botColor) return;
      try {
        if (typeof AIEngine === 'undefined') return;
        const ai = new AIEngine('medium');
        const best = ai.getBestMove(window.app.engine);
        if (best && this.onOpponentMove) {
          const fromAlg = ChessEngine.toAlgebraic(best.from.row, best.from.col);
          const toAlg = ChessEngine.toAlgebraic(best.to.row, best.to.col);
          this.onOpponentMove(fromAlg, toAlg, best.promotion || null);
        }
      } catch (e) {
        console.warn('[BridgeMultiplayer] bot move execution notice:', e);
      }
    }, 700 + Math.random() * 800);
  }

  sendMove(from, to, promotion = null) {
    this.send({ type: 'move', from, to, promotion });

    // Sync state for seamless recovery
    if (window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.setSyncState === 'function') {
      try {
        window.bridge.multiplayer.setSyncState({
          lastMove: { from, to, promotion, time: Date.now() }
        });
      } catch (e) {}
    }

    // If duel partner is simulated bot, play responsive moves using chess engine
    this._triggerBotMoveIfNeeded();
  }

  sendChatMessage(text) {
    const senderName = (this._selfProfile && this._selfProfile.username) || (window.app && window.app.username) || 'Player';
    this.send({ type: 'chat_message', sender: this.playerColor, senderName, text });
    if (this.onChatMessage) {
      this.onChatMessage(this.playerColor, senderName, text);
    }
    if (this._isBot && text) {
      setTimeout(() => {
        if (!this.onChatMessage) return;
        const botName = (this._opponentProfile && this._opponentProfile.username) || 'Opponent';
        const botColor = this.playerColor === 'white' ? 'black' : 'white';
        const clean = text.toLowerCase().trim();
        let reply = null;
        if (clean.includes('good luck')) reply = 'Good luck to you too!';
        else if (clean.includes('nice move')) reply = 'Thanks! You too!';
        else if (clean.includes('oops')) reply = 'No worries!';
        else if (clean.includes('good game')) reply = 'Good game!';
        else {
          const quickReplies = ['Well played!', 'Interesting move!', 'Good luck!'];
          reply = quickReplies[Math.floor(Math.random() * quickReplies.length)];
        }
        if (reply) {
          this.onChatMessage(botColor, botName, reply);
        }
      }, 1200);
    }
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
    this._rematchRequestedBySelf = true;
    this.send({ type: 'request_rematch' });
    if (this._isBot) {
      if (this._rematchBotTimeout) clearTimeout(this._rematchBotTimeout);
      this._rematchBotTimeout = setTimeout(() => {
        this.acceptRematch();
      }, 800);
    }
  }

  acceptRematch() {
    const myNewColor = this.playerColor === 'white' ? 'black' : 'white';
    const oppNewColor = this.playerColor; // opponent takes my previous color

    this._rematchRequestedBySelf = false;
    if (this._rematchBotTimeout) {
      clearTimeout(this._rematchBotTimeout);
      this._rematchBotTimeout = null;
    }
    if (this._botMoveTimer) {
      clearTimeout(this._botMoveTimer);
      this._botMoveTimer = null;
    }
    this.playerColor = myNewColor;
    this._state.started = true;
    this._state.lastMove = null;

    this.send({
      type: 'accept_rematch',
      color: oppNewColor,
      gameId: 'rematch_' + Date.now()
    });

    if (window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.setSyncState === 'function') {
      try {
        window.bridge.multiplayer.setSyncState({ lastMove: null, rematchAt: Date.now() });
      } catch (e) {}
    }

    if (this.onRematchAccepted) {
      this.onRematchAccepted(this.playerColor);
    }

    if (this._isBot && this.playerColor === 'black') {
      this._triggerBotMoveIfNeeded();
    }
  }

  declineRematch() {
    this._rematchRequestedBySelf = false;
    if (this._rematchBotTimeout) {
      clearTimeout(this._rematchBotTimeout);
      this._rematchBotTimeout = null;
    }
    this.send({ type: 'decline_rematch' });
  }

  cancelMatch() {
    this._isSearching = false;
    this._searchSessionId = (this._searchSessionId || 0) + 1;
    this._rematchRequestedBySelf = false;
    if (this._rematchBotTimeout) {
      clearTimeout(this._rematchBotTimeout);
      this._rematchBotTimeout = null;
    }
    if (this._matchTimeout) {
      clearTimeout(this._matchTimeout);
      this._matchTimeout = null;
    }
    if (this._statusTimer) {
      clearInterval(this._statusTimer);
      this._statusTimer = null;
    }
    if (this._botMoveTimer) {
      clearTimeout(this._botMoveTimer);
      this._botMoveTimer = null;
    }
    if (window.bridge && window.bridge.multiplayer && typeof window.bridge.multiplayer.leaveRoom === 'function') {
      try { window.bridge.multiplayer.leaveRoom(); } catch(e) {}
    }
    this.room = null;
    this.roomCode = null;
    this._state.started = false;
  }

  disconnect() {
    this.cancelMatch();
    this.isConnected = false;
  }

  startKeepAlive() {}
  stopKeepAlive() {}
}

window.BridgeMultiplayerClient = BridgeMultiplayerClient;
