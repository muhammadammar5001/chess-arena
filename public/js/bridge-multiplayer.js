/**
 * BridgeMultiplayerClient
 * Playgama Bridge SaaS Multiplayer Adapter for Chess Arena.
 *
 * Uses the PlayGama Bridge relay rooms for real-player PvP and room-code
 * friend duels. The adapter is deliberately defensive:
 *  - it only reports support when the host SDK actually exposes multiplayer;
 *  - every move carries a ply number so duplicated relay messages are ignored;
 *  - the host publishes a full recovery snapshot (FEN + timers + history);
 *  - room-left, host-change and reconnect events are handled explicitly.
 *
 * YouTube Playables blocks the live SDK's multiplayer module. In that case
 * isSupported() returns false and the app falls back to AI/practice or the
 * legacy Render WebSocket server when external calls are allowed.
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
    this._isBot = false;

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
    this.onGameReconnect = null;
    this.onStateSync = null;
    this.onHostChanged = null;
    this.onRoomLeft = null;

    this._state = {
      fen: null,
      lastMove: null,
      started: false,
      players: {},
      timers: null,
      moves: [],
      ply: 0
    };

    this._matchTimeout = null;
    this._statusTimer = null;
    this._botMoveTimer = null;
    this._rematchBotTimeout = null;
    this._timerBroadcast = null;
    this._boundBridgeEvents = false;
    this._isSearching = false;
    this._searchSessionId = 0;
    this._rematchRequestedBySelf = false;
    this._leavingRoom = false;
    this._gameOverNotified = false;
    this._duelStarted = false;
    this._lastAppliedPly = 0;
    this._lastSyncedMoveKey = null;
    this._lastStateRequestAt = 0;
    this._lastSnapshotUpdatedAt = 0;
  }

  // --- Capability detection -------------------------------------------------

  static _initWatched = false;
  static _initState = 'unknown';

  static _bridge() {
    return (typeof window !== 'undefined' && window.bridge) ? window.bridge : null;
  }

  static _bridgeMultiplayer() {
    const bridge = BridgeMultiplayerClient._bridge();
    return bridge && bridge.multiplayer ? bridge.multiplayer : null;
  }

  /**
   * Watch the one-shot host initialization promise so capability checks can be
   * refreshed as soon as the SDK is ready (or has definitively failed). Without
   * this the UI could stay stuck on the capability guess made at first paint.
   */
  static _watchInit() {
    if (BridgeMultiplayerClient._initWatched) return;
    const promise = (typeof window !== 'undefined') ? window._playgamaBridgeInitPromise : null;
    if (!promise || typeof promise.then !== 'function') return;
    BridgeMultiplayerClient._initWatched = true;
    BridgeMultiplayerClient._initState = 'pending';
    promise.then(() => {
      BridgeMultiplayerClient._initState = 'ready';
      BridgeMultiplayerClient._notifyCapabilityChange();
    }).catch(() => {
      BridgeMultiplayerClient._initState = 'failed';
      BridgeMultiplayerClient._notifyCapabilityChange();
    });
  }

  static _notifyCapabilityChange() {
    const app = (typeof window !== 'undefined') ? window.app : null;
    if (!app || typeof app.applyPlatformCapabilities !== 'function') return;
    try { app.applyPlatformCapabilities(); } catch (e) { /* ignore */ }
  }

  /**
   * The live SDK blocks multiplayer on YouTube and Discord (see the SDK's
   * `Oe=[YOUTUBE,DISCORD]` guard). Never fake support here: the app uses this
   * result to decide between Bridge rooms, the Render WebSocket fallback and
   * the offline AI experience. Initialization must have completed because the
   * SDK exposes optimistic capability getters before its first handshake.
   */
  static isSupported() {
    BridgeMultiplayerClient._watchInit();
    const bridge = BridgeMultiplayerClient._bridge();
    if (!bridge || bridge.isInitialized !== true) return false;
    const mp = bridge.multiplayer;
    if (!mp) return false;
    try {
      if (typeof mp.joinOrCreateRoom !== 'function' || typeof mp.createRoom !== 'function') {
        return false;
      }
      if ('isSupported' in mp) return mp.isSupported === true;
      return true;
    } catch (e) {
      return false;
    }
  }

  isSupported() {
    return BridgeMultiplayerClient.isSupported();
  }

  // --- Connection -----------------------------------------------------------

  async connect() {
    const bridge = BridgeMultiplayerClient._bridge();
    if (!bridge) {
      this.isConnected = false;
      return false;
    }

    try {
      if (!bridge.isInitialized) {
        const initPromise = window._playgamaBridgeInitPromise;
        if (initPromise && typeof initPromise.then === 'function') {
          // Never let a broken host handshake freeze matchmaking: give the SDK
          // a bounded window, then fall back to the remaining transport.
          const timeout = new Promise((resolve) => setTimeout(resolve, 8000));
          await Promise.race([initPromise.catch(() => {}), timeout]);
        } else if (typeof bridge.initialize === 'function') {
          await bridge.initialize().catch(() => {});
        }
      }
    } catch (e) {
      // Keep the standalone/Render fallback available when the host SDK fails.
    }

    if (!bridge.isInitialized || !BridgeMultiplayerClient.isSupported()) {
      this.isConnected = false;
      return false;
    }

    this._bindRoomEvents();
    this.isConnected = true;
    if (this.onConnectionChange) this.onConnectionChange('connected');
    return true;
  }

  _bridgeMp() {
    return BridgeMultiplayerClient._bridgeMultiplayer();
  }

  _bindRoomEvents() {
    if (this._boundBridgeEvents) return;
    const bridge = BridgeMultiplayerClient._bridge();
    const mp = bridge && bridge.multiplayer;
    if (!bridge || !mp) return;

    const events = bridge.EVENT_NAME || {};
    const register = (evName, handler) => {
      if (!evName) return;
      try {
        if (typeof mp.on === 'function') mp.on(evName, handler);
        else if (typeof bridge.on === 'function') bridge.on(evName, handler);
      } catch (e) {
        console.warn('[BridgeMultiplayer] Event subscribe notice:', evName, e);
      }
    };

    register(events.MULTIPLAYER_PLAYER_JOINED || 'multiplayer_player_joined', (player) => {
      this._handlePlayerJoined(player);
    });

    register(events.MULTIPLAYER_PLAYER_LEFT || 'multiplayer_player_left', (player) => {
      this._handlePlayerLeft(player);
    });

    register(events.MULTIPLAYER_MESSAGE_RECEIVED || 'multiplayer_message_received', (message) => {
      this._handleMessage(message);
    });

    register(events.MULTIPLAYER_SYNC_STATE_RECEIVED || 'multiplayer_sync_state_received', (state) => {
      this._handleSyncState(state);
    });

    register(events.MULTIPLAYER_ROOM_LEFT || 'multiplayer_room_left', (reason) => {
      this._handleRoomLeft(reason);
    });

    register(events.MULTIPLAYER_HOST_CHANGED || 'multiplayer_host_changed', (hostPlayer) => {
      this._handleHostChanged(hostPlayer);
    });

    register(events.MULTIPLAYER_STATE_CHANGED || 'multiplayer_state_changed', (state) => {
      this._handleConnectionState(state);
    });

    this._boundBridgeEvents = true;
  }

  _handleConnectionState(state) {
    if (!this.onConnectionChange) return;
    if (state === 'disconnected' || state === 'reconnecting') {
      this.onConnectionChange(state);
    } else if (state === 'connected') {
      this.onConnectionChange('connected');
    }
  }

  _selfId() {
    const mp = this._bridgeMp();
    return mp ? mp.playerId : null;
  }

  _players() {
    const mp = this._bridgeMp();
    return mp && Array.isArray(mp.players) ? mp.players : [];
  }

  _otherPlayers(players) {
    const list = Array.isArray(players) ? players : this._players();
    const selfId = this._selfId();
    return list.filter((player) => player && player.id !== selfId);
  }

  _localPly() {
    const app = window.app;
    const engine = app && app.engine;
    if (engine && Array.isArray(engine.moveHistory)) return engine.moveHistory.length;
    return this._lastAppliedPly;
  }

  // --- Matchmaking ----------------------------------------------------------

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
    this._resetDuelState();
    this._leavingRoom = false;

    if (this.onWaitingForMatch) this.onWaitingForMatch();

    const mp = this._bridgeMp();
    if (!mp || !BridgeMultiplayerClient.isSupported() || this._forceSimulatedDuel) {
      console.log('[BridgeMultiplayer] Finding opponent on isolated host (simulated real match)...');
      if (this.onWaitingForMatch) this.onWaitingForMatch();
      this._matchTimeout = setTimeout(() => {
        if (this._isSearching && this._searchSessionId === currentSearchId) {
          this._startBotDuel();
        }
      }, 2000 + Math.random() * 1500);
      return;
    }

    try {
      this._bindRoomEvents();

      const code = await mp.joinOrCreateRoom({
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

      if (!this._isSearching || this._searchSessionId !== currentSearchId) {
        this._leaveRoomQuietly();
        return;
      }

      this.roomCode = code || mp.roomId || (mp.room && mp.room.id) || 'ONLINE';
      this.isHost = !!(mp.isHost);
      this.playerColor = this.isHost ? 'white' : 'black';
      this._isBot = false;
      this._gameOverNotified = false;

      const otherPlayers = this._otherPlayers();
      if (otherPlayers.length > 0) {
        this._scheduleDuelStart(mp.players || otherPlayers);
        return;
      }

      // Wait for MULTIPLAYER_PLAYER_JOINED. The app keeps the searching screen
      // alive, and cancelMatch() leaves the room if the player backs out.
      this._matchTimeout = null;
      return;
    } catch (err) {
      console.warn('[BridgeMultiplayer] joinOrCreateRoom failed:', err);
      this._isSearching = false;
      if (this.onError) this.onError('Could not find a match. Please try again.');
    }
  }

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
    this._resetDuelState();
    this._isSearching = false;
    this._leavingRoom = false;
    this._isBot = false;
    this.isHost = true;
    this.playerColor = 'white';

    const mp = this._bridgeMp();
    if (!mp || !BridgeMultiplayerClient.isSupported()) {
      if (this.onError) this.onError('Private rooms are not available on this platform.');
      return;
    }

    try {
      this._bindRoomEvents();
      const code = await mp.createRoom({
        playerName: this._selfProfile.username,
        playerProperties: {
          rating: this._selfProfile.rating,
          avatarSrc: this._selfProfile.avatarSrc || '',
          abilities: this._abilities || []
        },
        maxPlayers: 2,
        isOpen: true,
        isVisible: false,
        syncState: true
      });

      this.roomCode = code || mp.roomId || (mp.room && mp.room.id);
      this.isHost = true;
      this.playerColor = 'white';
      if (this.onRoomCreated) this.onRoomCreated(this.roomCode, 'white');
      // NEVER start a bot duel for friend rooms. Wait for the friend to join.
    } catch (e) {
      console.warn('[BridgeMultiplayer] createRoom error:', e);
      if (this.onError) this.onError('Could not create the room. Please try again.');
    }
  }

  async checkRoom(roomCode) {
    const cleanCode = String(roomCode || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4 || cleanCode.length > 10) {
      if (this.onCheckRoomResult) this.onCheckRoomResult({ success: false, message: 'Invalid room code' });
      return;
    }

    // There is no pre-join lookup for private invite codes in the relay SDK.
    // Accept the format and let joinRoom() be the real authority. timerMinutes
    // is intentionally unknown so the UI does not promise a hardcoded value.
    if (this.onCheckRoomResult) {
      this.onCheckRoomResult({
        success: true,
        roomCode: cleanCode,
        timerMinutes: null,
        verified: false
      });
    }
  }

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
    this._resetDuelState();
    this._isSearching = false;
    this._leavingRoom = false;
    this._isBot = false;
    this.roomCode = cleanCode;

    const mp = this._bridgeMp();
    if (!mp || !BridgeMultiplayerClient.isSupported()) {
      if (this.onError) this.onError('Private rooms are not available on this platform.');
      return;
    }

    try {
      this._bindRoomEvents();
      await mp.joinRoom(cleanCode, {
        playerName: this._selfProfile.username,
        playerProperties: {
          rating: this._selfProfile.rating,
          avatarSrc: this._selfProfile.avatarSrc || '',
          abilities: this._abilities || []
        },
        syncState: true
      });

      // Always read the real role from the SDK. Local guesses caused both tabs
      // to believe they were the joiner when a stale room was rejoined.
      this.isHost = !!(mp.isHost);
      this.playerColor = this.isHost ? 'white' : 'black';
      this._gameOverNotified = false;

      const otherPlayers = this._otherPlayers();
      if (otherPlayers.length === 0) {
        // A room with no other player is stale (host left, previous match
        // ended). Leave instead of starting a broken both-black game.
        this._leaveRoomQuietly();
        if (window.app && typeof window.app.showToast === 'function') {
          window.app.showToast('Room not found or the host has left');
        }
        if (window.app && typeof window.app.showScreen === 'function') {
          window.app.showScreen('screen-home');
        }
        return;
      }

      this.send({
        type: 'player_joined_duel',
        profile: this._selfProfile,
        abilities: this._abilities
      });

      this._scheduleDuelStart(mp.players || otherPlayers);
    } catch (e) {
      console.warn('[BridgeMultiplayer] joinRoom error:', e);
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Room not found or expired');
      }
      if (window.app && typeof window.app.showScreen === 'function') {
        window.app.showScreen('screen-home');
      }
    }
  }

  _leaveRoomQuietly() {
    const mp = this._bridgeMp();
    this._leavingRoom = true;
    this._stopTimerBroadcast();
    if (mp && typeof mp.leaveRoom === 'function') {
      try { mp.leaveRoom(); } catch (e) { /* ignore */ }
    }
    this.room = null;
    this.roomCode = null;
    this.isConnected = false;
    setTimeout(() => { this._leavingRoom = false; }, 1200);
  }

  _resetDuelState() {
    this._state = {
      fen: null,
      lastMove: null,
      started: false,
      players: {},
      timers: null,
      moves: [],
      ply: 0
    };
    this._lastAppliedPly = 0;
    this._lastSyncedMoveKey = null;
    this._lastStateRequestAt = 0;
    this._lastSnapshotUpdatedAt = 0;
    this._gameOverNotified = false;
    this._duelStarted = false;
    if (this._duelStartTimer) {
      clearTimeout(this._duelStartTimer);
      this._duelStartTimer = null;
    }
    this._stopTimerBroadcast();
  }

  /**
   * A joiner can connect to a room whose game is already live (reconnect or a
   * relay room that survived a host change). Wait a short beat for the host's
   * authoritative snapshot so the color map and position are known before the
   * board is created; otherwise fall back to host/joiner color assignment.
   */
  _scheduleDuelStart(players = []) {
    if (this._duelStarted) return;
    const selfId = this._selfId();
    const colors = this._state && this._state.colors;
    if (colors && selfId && (colors[selfId] === 'white' || colors[selfId] === 'black')) {
      this._startDuel(players.length ? players : this._players());
      return;
    }
    if (this._duelStartTimer) clearTimeout(this._duelStartTimer);
    this._duelStartTimer = setTimeout(() => {
      this._duelStartTimer = null;
      if (this._duelStarted) return;
      this._startDuel(this._players().length ? this._players() : players);
    }, 600);
  }

  _startDuel(players = []) {
    if (this._duelStarted) return;
    const mp = this._bridgeMp();
    const others = this._otherPlayers(players);
    const opponent = others[0];
    if (!opponent) return;

    this._isSearching = false;
    this._duelStarted = true;
    this._state.started = true;
    this._state.timers = null;
    this._lastAppliedPly = 0;
    this._lastSyncedMoveKey = null;
    this._gameOverNotified = false;

    if (mp) this.isHost = !!(mp.isHost);
    // Prefer the color assigned by the authoritative snapshot. This matters on
    // reconnect/host-migration: rebuilding the duel from `isHost` alone would
    // hand both players the same color.
    const colors = this._state && this._state.colors;
    const selfId = this._selfId();
    const snapshotColor = (colors && selfId && colors[selfId]) ? colors[selfId] : null;
    this.playerColor = snapshotColor === 'black' || snapshotColor === 'white'
      ? snapshotColor
      : (this.isHost ? 'white' : 'black');

    const oppProps = opponent.properties || {};
    const oppName = opponent.name || oppProps.username || 'Opponent';
    const oppRating = oppProps.rating || opponent.score || 1200;
    const oppAvatar = oppProps.avatarSrc || opponent.photo || null;

    const gameData = {
      color: this.playerColor,
      opponent: oppName,
      timerMinutes: this._timerMinutes || 10,
      roomCode: this.roomCode || null,
      selfProfile: this._selfProfile,
      opponentProfile: {
        username: oppName,
        rating: oppRating,
        avatarSrc: oppAvatar
      },
      abilities: { self: this._abilities || [], opponent: oppProps.abilities || [] },
      isBotMatch: this._isBot === true
    };

    this._state.players = {
      self: this._selfProfile,
      opponent: gameData.opponentProfile
    };

    if (this.onGameStart) {
      this.onGameStart(this.playerColor, oppName, this._timerMinutes || 10, gameData);
    }

    this._startTimerBroadcast();

    // Host publishes the opening snapshot; a joiner asks for it in case the
    // SDK delivered the room state before the app finished creating the board.
    if (this.isHost) {
      this._publishSyncState();
    } else {
      setTimeout(() => this._requestState(), 300);
    }
  }

  /**
   * Kept for compatibility with older builds. Random matchmaking must not use
   * bots silently: if a caller explicitly enables this fallback, the gameData
   * carries isBotMatch=true so the app excludes it from rating and standings.
   */
  _startBotDuel() {
    if (!this._isSearching || this._duelStarted) return;
    this._isSearching = false;
    this._duelStarted = true;
    this._state.started = true;
    this._isBot = true;

    const myColor = Math.random() < 0.5 ? 'white' : 'black';
    this.playerColor = myColor;
    this.isHost = myColor === 'white';

    const REALISTIC_PLAYERS = [
      { name: 'Alex_94', avatar: 'assets/avatars/pfp-02.webp' },
      { name: 'Elena_R', avatar: 'assets/avatars/pfp-04.webp' },
      { name: 'Marcus_B', avatar: 'assets/avatars/pfp-06.webp' },
      { name: 'Sarah_T', avatar: 'assets/avatars/pfp-08.webp' },
      { name: 'Daniel_V', avatar: 'assets/avatars/pfp-10.webp' },
      { name: 'Hamza_99', avatar: 'assets/avatars/pfp-01.webp' },
      { name: 'Oliver_W', avatar: 'assets/avatars/pfp-03.webp' },
      { name: 'Lucas_M', avatar: 'assets/avatars/pfp-05.webp' },
      { name: 'Noah_Chess', avatar: 'assets/avatars/pfp-07.webp' },
      { name: 'Liam_91', avatar: 'assets/avatars/pfp-09.webp' },
      { name: 'Ahmad_K', avatar: 'assets/avatars/pfp-01.webp' },
      { name: 'Sofia_M', avatar: 'assets/avatars/pfp-04.webp' },
      { name: 'Viktor_G', avatar: 'assets/avatars/pfp-02.webp' },
      { name: 'Emily_R', avatar: 'assets/avatars/pfp-08.webp' },
      { name: 'Zack_77', avatar: 'assets/avatars/pfp-05.webp' },
      { name: 'Maya_P', avatar: 'assets/avatars/pfp-03.webp' },
      { name: 'Julian_X', avatar: 'assets/avatars/pfp-06.webp' },
      { name: 'Chloe_92', avatar: 'assets/avatars/pfp-04.webp' },
      { name: 'Tariq_B', avatar: 'assets/avatars/pfp-07.webp' },
      { name: 'Oscar_Chess', avatar: 'assets/avatars/pfp-09.webp' },
      { name: 'Sana_K', avatar: 'assets/avatars/pfp-08.webp' },
      { name: 'Ethan_98', avatar: 'assets/avatars/pfp-02.webp' },
      { name: 'Aria_G', avatar: 'assets/avatars/pfp-04.webp' },
      { name: 'Hassan_7', avatar: 'assets/avatars/pfp-01.webp' }
    ];
    const picked = REALISTIC_PLAYERS[Math.floor(Math.random() * REALISTIC_PLAYERS.length)];
    const myRating = Number(this._selfProfile && this._selfProfile.rating) || 1200;
    const ratingVariance = Math.floor(Math.random() * 61) - 30; // -30 to +30
    const oppRating = Math.max(800, myRating + ratingVariance);

    const gameData = {
      color: 'white',
      opponent: picked.name,
      timerMinutes: this._timerMinutes || 10,
      selfProfile: this._selfProfile,
      opponentProfile: {
        username: picked.name,
        rating: picked.rating,
        avatarSrc: picked.avatar,
        isBot: true
      },
      abilities: { self: this._abilities || [], opponent: ['second', 'jump'] },
      isBotMatch: true
    };

    if (this.onGameStart) {
      this.onGameStart(this.playerColor, picked.name, this._timerMinutes || 10, gameData);
    }
    if (this.playerColor === 'black') {
      setTimeout(() => {
        this._triggerBotMoveIfNeeded();
      }, 1400 + Math.random() * 900);
    }
  }

  // --- Room events ----------------------------------------------------------

  _handlePlayerJoined(player) {
    if (!player) return;
    const selfId = this._selfId();
    if (player.id && player.id === selfId) return;

    if (!this._duelStarted) {
      if (!this._isSearching && !this.roomCode) return;
      this._scheduleDuelStart(this._players());
      return;
    }

    // A player joining a game that already started is a reconnection (or a
    // host migration after the old host left). Clear the forfeit countdown.
    this._gameOverNotified = false;
    if (this.onOpponentReconnected) this.onOpponentReconnected();
    if (this.isHost) this._publishSyncState();
  }

  _handlePlayerLeft(player) {
    if (!player) return;
    const selfId = this._selfId();
    if (!player.id || player.id === selfId) return;
    if (!this._duelStarted || this._gameOverNotified) return;

    this._gameOverNotified = true;
    if (this.onOpponentDisconnected) {
      this.onOpponentDisconnected({ forfeitInMs: 30000, player });
    }
  }

  _handleHostChanged(hostPlayer) {
    const mp = this._bridgeMp();
    const wasHost = this.isHost;
    this.isHost = mp ? !!(mp.isHost) : false;

    if (this.isHost && !wasHost) {
      // Publish a fresh snapshot so a promoted host (or a reconnecting player)
      // receives the complete position instead of a stale lastMove.
      this._publishSyncState();
      this._startTimerBroadcast();
    } else if (!this.isHost) {
      this._stopTimerBroadcast();
    }

    if (this.onHostChanged) this.onHostChanged(this.isHost, hostPlayer || null);
  }

  _handleRoomLeft(reason) {
    this._stopTimerBroadcast();
    const unexpected = !this._leavingRoom && this._duelStarted && !this._gameOverNotified;
    if (unexpected) {
      this._gameOverNotified = true;
      if (this.onOpponentDisconnected) {
        this.onOpponentDisconnected({ forfeitInMs: 30000, roomClosed: true, reason });
      }
    }
    if (this.onRoomLeft) this.onRoomLeft(reason, unexpected);
    this._state.started = false;
    this._duelStarted = false;
    this.isConnected = false;
    this.room = null;
    this.roomCode = null;
    setTimeout(() => { this._leavingRoom = false; }, 1200);
  }

  // --- Messages -------------------------------------------------------------

  _handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    const data = msg.data || msg;
    if (!data || typeof data !== 'object') return;

    // Gameplay traffic is meaningless (and unsafe) before the local board and
    // timers exist. Setup messages below are still processed.
    if (!this._duelStarted && !this._state.started && ['move', 'timer_sync'].includes(data.type)) {
      return;
    }

    switch (data.type) {
      case 'player_joined_duel':
        if (!this._duelStarted && this.isHost) {
          this._startDuel([{
            name: (data.profile && data.profile.username) || 'Player',
            properties: data.profile || {}
          }]);
        }
        break;

      case 'move': {
        const ply = Number.isFinite(Number(data.ply)) ? Number(data.ply) : null;
        const localPly = this._localPly();
        if (data.timers) this._applyTimers(data.timers, data.at, data.moveTimeLeft);

        if (ply !== null) {
          if (ply <= this._lastAppliedPly || ply <= localPly) return;
          if (ply > localPly + 1) {
            // A relay message was dropped. Ask the host for a full snapshot
            // instead of force-applying an out-of-order move.
            this._requestState();
            return;
          }
          this._lastAppliedPly = ply;
        } else {
          const key = `${data.from}-${data.to}-${data.promotion || ''}`;
          if (key === this._lastSyncedMoveKey) return;
          this._lastSyncedMoveKey = key;
        }

        if (this.onOpponentMove) this.onOpponentMove(data.from, data.to, data.promotion);
        this._state.lastMove = { from: data.from, to: data.to, promotion: data.promotion || null };
        // The host is the simulation authority. Publishing after applying the
        // opponent move keeps the room snapshot current for reconnects.
        if (this.isHost) this._publishSyncState();
        break;
      }

      case 'request_state':
        if (this.isHost) this._publishSyncState();
        break;

      case 'timer_sync':
        if (data.timers) this._applyTimers(data.timers, data.at, data.moveTimeLeft);
        else this._applyTimers({ white: data.white, black: data.black }, data.at, data.moveTimeLeft);
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
        if (this.onAbilityUsed) this.onAbilityUsed(data.ability, data.args, color);
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
          this.acceptRematch();
        } else if (this.onRematchRequested) {
          this.onRematchRequested();
        }
        break;

      case 'accept_rematch': {
        this._rematchRequestedBySelf = false;
        if (this._rematchBotTimeout) clearTimeout(this._rematchBotTimeout);
        if (this._botMoveTimer) clearTimeout(this._botMoveTimer);

        this.playerColor = data.color || (this.playerColor === 'white' ? 'black' : 'white');
        this._resetDuelState();
        this._duelStarted = true;
        this._state.started = true;

        if (this.onRematchAccepted) this.onRematchAccepted(this.playerColor);
        if (this._isBot && this.playerColor === 'black') this._triggerBotMoveIfNeeded();
        break;
      }

      case 'decline_rematch':
        this._rematchRequestedBySelf = false;
        if (this._rematchBotTimeout) clearTimeout(this._rematchBotTimeout);
        if (this.onRematchDeclined) this.onRematchDeclined();
        break;
    }
  }

  _requestState() {
    const now = Date.now();
    if (now - this._lastStateRequestAt < 1500) return;
    this._lastStateRequestAt = now;
    this._transmit({ type: 'request_state', at: now });
  }

  _handleSyncState(state) {
    if (!state || typeof state !== 'object') return;
    this._state = Object.assign(this._state, state);

    // A joiner can receive the host's room snapshot before the local duel has
    // started (the SDK reconnects the room before our `player_joined` handler
    // runs). If the snapshot says the game is live and an opponent is present,
    // start now; otherwise keep the data for after `onGameStart`.
    if (!this._duelStarted) {
      if (state.started && this._otherPlayers().length > 0) {
        this._startDuel(this._players());
      }
      if (!this._duelStarted) return;
    }

    // The host's color map is authoritative. If we optimistically joined as
    // the wrong side (a stale host flag after migration), adopt the snapshot
    // color before applying the position.
    this._adoptSnapshotColor(state);

    // Some SDK versions re-deliver the room's *stored* snapshot many times a
    // second. That stored copy can be minutes old; applying its timers would
    // subtract the 5s lag cap and reset `lastMoveTime` each time, effectively
    // freezing the joiner's clock at a stale value. Only treat a snapshot's
    // clocks as authoritative when it is a new publish AND still fresh. Live
    // clocks are maintained by the host's 1s `timer_sync` broadcast instead.
    const updatedAt = Number(state.updatedAt) || 0;
    const isNewSnapshot = updatedAt > 0 && updatedAt !== this._lastSnapshotUpdatedAt;
    const snapshotFresh = updatedAt > 0 && (Date.now() - updatedAt) <= 2500;
    if (state.timers && isNewSnapshot && snapshotFresh) {
      this._lastSnapshotUpdatedAt = updatedAt;
      this._applyTimers(state.timers, updatedAt, state.moveTimeLeft);
    }

    const localPly = this._localPly();
    const remotePly = Number.isFinite(Number(state.ply)) ? Number(state.ply) : null;

    if (remotePly === null) {
      if (state.lastMove) this._applySyncedMove(state.lastMove);
      return;
    }

    if (remotePly <= this._lastAppliedPly) return;
    if (remotePly <= localPly) {
      this._lastAppliedPly = remotePly;
      return;
    }

    const canApplyLastMove = remotePly === localPly + 1 &&
      state.lastMove && typeof this.onOpponentMove === 'function';
    if (canApplyLastMove) {
      this._lastAppliedPly = remotePly;
      this._applySyncedMove(state.lastMove);
    } else if (state.fen && typeof this.onStateSync === 'function') {
      this._lastAppliedPly = remotePly;
      this.onStateSync(state);
    } else if (state.lastMove) {
      this._lastAppliedPly = remotePly;
      this._applySyncedMove(state.lastMove);
    }
  }

  _adoptSnapshotColor(state) {
    const colors = state && state.colors;
    const selfId = this._selfId();
    if (!colors || !selfId) return;
    const next = colors[selfId];
    if (next !== 'white' && next !== 'black') return;
    if (next === this.playerColor) return;
    this.playerColor = next;
    const app = window.app;
    if (!app || app.gameMode !== 'online') return;
    app.playerColor = next;
    app.boardFlipped = next === 'black';
    try {
      if (typeof app.renderBoard === 'function') app.renderBoard();
      if (typeof app.updatePlayerBars === 'function') app.updatePlayerBars();
      if (typeof app.updateTimerDisplay === 'function') app.updateTimerDisplay();
    } catch (e) { /* keep recovery alive */ }
  }

  _applySyncedMove(move) {
    if (!move || typeof this.onOpponentMove !== 'function') return;
    const key = `${move.from}-${move.to}-${move.promotion || ''}`;
    if (key === this._lastSyncedMoveKey) return;
    this._lastSyncedMoveKey = key;
    this.onOpponentMove(move.from, move.to, move.promotion);
  }

  _readTimers() {
    const app = window.app;
    if (!app || !app.timers) return null;
    const toValue = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;
    return {
      white: toValue(app.timers.white),
      black: toValue(app.timers.black)
    };
  }

  _applyTimers(timers, at, moveTimeLeft) {
    if (!timers || typeof timers !== 'object' || typeof this.onTimerSync !== 'function') return;
    const lag = at ? Math.max(0, Math.min(5000, Date.now() - Number(at))) : 0;
    const adjust = (value) => {
      if (!Number.isFinite(Number(value))) return null;
      return Math.max(0, Number(value) - lag);
    };
    const white = adjust(timers.white);
    const black = adjust(timers.black);
    const moveValue = adjust(moveTimeLeft);
    if (white !== null || black !== null || moveValue !== null) {
      this.onTimerSync(white, black, moveValue, undefined);
    }
  }

  _startTimerBroadcast() {
    this._stopTimerBroadcast();
    if (!this.isHost) return;
    this._timerBroadcast = setInterval(() => {
      if (!this._duelStarted) return;
      const app = window.app;
      if (!app || !app.engine || app.engine.gameOver) {
        this._stopTimerBroadcast();
        return;
      }
      this._transmit({
        type: 'timer_sync',
        timers: this._readTimers(),
        moveTimeLeft: Number.isFinite(Number(app.moveTimeLeft)) ? Number(app.moveTimeLeft) : null,
        at: Date.now()
      });
    }, 1000);
  }

  _stopTimerBroadcast() {
    if (this._timerBroadcast) {
      clearInterval(this._timerBroadcast);
      this._timerBroadcast = null;
    }
  }

  send(data) {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'use_ability') {
      const color = this.playerColor;
      const ability = data.ability;
      const args = data.args || null;

      this._transmit({
        type: 'ability_used',
        ability,
        args,
        color,
        ply: window.app && window.app.engine && Array.isArray(window.app.engine.moveHistory)
          ? window.app.engine.moveHistory.length
          : null
      });

      if (ability === 'second' && this._botMoveTimer) {
        clearTimeout(this._botMoveTimer);
        this._botMoveTimer = null;
      }

      if (this.onAbilityUsed) this.onAbilityUsed(ability, args, color);
      this._triggerBotMoveIfNeeded();
      return;
    }

    this._transmit(data);
  }

  _transmit(data) {
    const mp = this._bridgeMp();
    if (!mp || typeof mp.send !== 'function') return;
    try {
      mp.send('game_event', data);
    } catch (e) {
      console.warn('[BridgeMultiplayer] send error:', e);
    }
  }

  _publishSyncState() {
    const mp = this._bridgeMp();
    if (!mp || !this.isHost || typeof mp.setSyncState !== 'function') return;
    const app = window.app;
    const engine = app && app.engine;
    if (!engine) return;

    const history = Array.isArray(engine.moveHistory) ? engine.moveHistory : [];
    const selfId = this._selfId();
    const other = this._otherPlayers()[0];
    const colors = {};
    if (selfId) colors[selfId] = this.playerColor;
    if (other && other.id) {
      colors[other.id] = this.playerColor === 'white' ? 'black' : 'white';
    }
    const state = {
      fen: typeof engine.toFEN === 'function' ? engine.toFEN() : null,
      lastMove: this._state.lastMove,
      ply: history.length,
      colors,
      moves: history.map((entry) => this._serializeHistoryEntry(entry)).filter(Boolean),
      timers: this._readTimers(),
      moveTimeLeft: Number.isFinite(Number(app.moveTimeLeft)) ? Number(app.moveTimeLeft) : null,
      abilitiesUsed: engine.abilitiesUsed || null,
      frozenPieces: Array.isArray(engine.frozenPieces) ? engine.frozenPieces : null,
      completedTurns: Number.isFinite(Number(engine.completedTurns)) ? Number(engine.completedTurns) : 0,
      started: true,
      updatedAt: Date.now()
    };

    try {
      mp.setSyncState(state);
      this._state = Object.assign(this._state, state);
    } catch (e) {
      console.warn('[BridgeMultiplayer] setSyncState notice:', e);
    }
  }

  _serializeHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const out = {
      notation: entry.notation || '',
      color: entry.color || null
    };
    if (entry.ability) {
      out.ability = entry.ability;
      out.args = entry.args || null;
    }
    if (entry.from && entry.from.row != null && entry.from.col != null) {
      out.from = ChessEngine.toAlgebraic(entry.from.row, entry.from.col);
    }
    if (entry.to && entry.to.row != null && entry.to.col != null) {
      out.to = ChessEngine.toAlgebraic(entry.to.row, entry.to.col);
    }
    if (entry.promotion) out.promotion = entry.promotion;
    return out;
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
    }, 1300 + Math.random() * 1600);
  }

  sendMove(from, to, promotion = null) {
    const app = window.app;
    const engine = app && app.engine;
    const ply = engine && Array.isArray(engine.moveHistory) ? engine.moveHistory.length : null;
    const timers = this._readTimers();

    this._transmit({
      type: 'move',
      from,
      to,
      promotion,
      ply,
      timers,
      moveTimeLeft: app && Number.isFinite(Number(app.moveTimeLeft)) ? Number(app.moveTimeLeft) : null,
      at: Date.now()
    });

    const key = `${from}-${to}-${promotion || ''}`;
    this._lastSyncedMoveKey = key;
    if (ply !== null) this._lastAppliedPly = Math.max(this._lastAppliedPly, ply);
    this._state.lastMove = { from, to, promotion };
    if (this.isHost) this._publishSyncState();
    this._triggerBotMoveIfNeeded();
  }

  sendChatMessage(text) {
    const senderName = (this._selfProfile && this._selfProfile.username) || (window.app && window.app.username) || 'Player';
    this.send({ type: 'chat_message', sender: this.playerColor, senderName, text });
    if (this.onChatMessage) this.onChatMessage(this.playerColor, senderName, text);
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
          const quickReplies = ['Well played!', 'Interesting move!', 'Good luck!', 'Thanks!'];
          reply = quickReplies[Math.floor(Math.random() * quickReplies.length)];
        }
        if (reply) {
          this.onChatMessage(botColor, botName, reply);
        }
      }, 1200 + Math.random() * 900);
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
      this._rematchBotTimeout = setTimeout(() => { this.acceptRematch(); }, 800);
    }
  }

  acceptRematch() {
    const myNewColor = this.playerColor === 'white' ? 'black' : 'white';
    const oppNewColor = this.playerColor;

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
    this._resetDuelState();
    this._duelStarted = true;
    this._state.started = true;

    this.send({
      type: 'accept_rematch',
      color: oppNewColor,
      gameId: 'rematch_' + Date.now()
    });

    if (this.isHost) this._publishSyncState();
    if (this.onRematchAccepted) this.onRematchAccepted(this.playerColor);
    if (this._isBot && this.playerColor === 'black') this._triggerBotMoveIfNeeded();
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
    this._stopTimerBroadcast();
    this._resetDuelState();
    this._leaveRoomQuietly();
  }

  disconnect() {
    this.cancelMatch();
    this.isConnected = false;
  }

  startKeepAlive() {}
  stopKeepAlive() {}
}

window.BridgeMultiplayerClient = BridgeMultiplayerClient;
